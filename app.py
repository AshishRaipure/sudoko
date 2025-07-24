from flask import Flask, render_template, request, jsonify, session, g
from flask_cors import CORS
from sudoku_solver import SudokuSolver
import json
import socket
import os
from datetime import timedelta, datetime, date
import time
import logging
import uuid
from functools import wraps
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Security Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# Production security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
    return response

# CORS Configuration - restrict to specific origins in production
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
CORS(app, origins=CORS_ORIGINS)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Game state storage (in production, use Redis or database)
game_states = {}
user_stats = {}
daily_puzzles = {}

# Initialize solver
sudoku_solver = SudokuSolver()

def get_local_ip():
    """Get the local IP address of this computer"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "127.0.0.1"

def get_user_id():
    """Get or create user ID for session"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    return session['user_id']

def get_user_stats(user_id):
    """Get user statistics"""
    if user_id not in user_stats:
        user_stats[user_id] = {
            'total_games': 0,
            'completed_games': 0,
            'best_times': {},
            'current_streak': 0,
            'longest_streak': 0,
            'achievements': [],
            'last_played': None,
            'total_play_time': 0,
            'hints_used': 0,
            'notes_used': 0
        }
    return user_stats[user_id]

def save_user_stats(user_id, stats):
    """Save user statistics"""
    user_stats[user_id] = stats

def get_daily_puzzle(date_str):
    """Get or generate daily puzzle for a specific date"""
    if date_str not in daily_puzzles:
        # Generate puzzle with consistent seed based on date
        puzzle, solution = sudoku_solver.generate_puzzle_with_seed(date_str, 'medium')
        daily_puzzles[date_str] = {
            'puzzle': puzzle,
            'solution': solution,
            'difficulty': 'medium'
        }
    return daily_puzzles[date_str]

@app.route('/')
def index():
    """Main game page"""
    return render_template('index.html')

@app.route('/api/new-game', methods=['POST'])
def new_game():
    """Generate a new Sudoku puzzle with enhanced options"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Invalid JSON data'}), 400
        
        game_mode = data.get('game_mode', 'classic')
        difficulty = data.get('difficulty', 'medium')
        seed = data.get('seed', None)
        
        valid_modes = ['classic', 'time_attack', 'zen', 'daily']
        valid_difficulties = ['easy', 'medium', 'hard', 'expert']
        
        if game_mode not in valid_modes:
            return jsonify({'success': False, 'error': 'Invalid game mode'}), 400
        
        if difficulty not in valid_difficulties:
            return jsonify({'success': False, 'error': 'Invalid difficulty level'}), 400
        
        # Generate puzzle based on mode
        if game_mode == 'daily':
            today = date.today().isoformat()
            puzzle_data = get_daily_puzzle(today)
            puzzle = puzzle_data['puzzle']
            solution = puzzle_data['solution']
            difficulty = puzzle_data['difficulty']
        else:
            if seed:
                puzzle, solution = sudoku_solver.generate_puzzle_with_seed(seed, difficulty)
            else:
                puzzle, solution = sudoku_solver.generate_puzzle(difficulty)
        
        # Calculate puzzle statistics
        empty_cells = sum(1 for row in puzzle for cell in row if cell == 0)
        total_cells = 81
        
        # Create game state
        user_id = get_user_id()
        game_id = str(uuid.uuid4())
        game_state = {
            'game_id': game_id,
            'user_id': user_id,
            'game_mode': game_mode,
            'difficulty': difficulty,
            'puzzle': puzzle,
            'solution': solution,
            'current_board': [row[:] for row in puzzle],
            'notes': [[[] for _ in range(9)] for _ in range(9)],
            'moves_history': [],
            'redo_stack': [],
            'start_time': time.time(),
            'hints_used': 0,
            'notes_used': 0,
            'is_completed': False
        }
        
        game_states[game_id] = game_state
        
        return jsonify({
            'success': True,
            'game_id': game_id,
            'puzzle': puzzle,
            'solution': solution,
            'difficulty': difficulty,
            'game_mode': game_mode,
            'stats': {
                'empty_cells': empty_cells,
                'filled_cells': total_cells - empty_cells,
                'completion_percentage': round(((total_cells - empty_cells) / total_cells) * 100, 1)
            }
        })
    except Exception as e:
        logger.error(f"Error generating new game: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate puzzle. Please try again.'
        }), 500

@app.route('/api/make-move', methods=['POST'])
def make_move():
    """Make a move in the game with undo/redo support"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        row = data.get('row')
        col = data.get('col')
        value = data.get('value')
        move_type = data.get('move_type', 'number')  # 'number' or 'note'
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        
        # Validate move
        if row < 0 or row >= 9 or col < 0 or col >= 9:
            return jsonify({'success': False, 'error': 'Invalid cell position'}), 400
        
        if value < 0 or value > 9:
            return jsonify({'success': False, 'error': 'Invalid value'}), 400
        
        # Check if cell is original
        if game_state['puzzle'][row][col] != 0:
            return jsonify({'success': False, 'error': 'Cannot modify original cells'}), 400
        
        # Save move to history
        old_value = game_state['current_board'][row][col]
        old_notes = game_state['notes'][row][col][:] if move_type == 'note' else []
        
        move = {
            'row': row,
            'col': col,
            'old_value': old_value,
            'new_value': value,
            'old_notes': old_notes,
            'move_type': move_type,
            'timestamp': time.time()
        }
        
        game_state['moves_history'].append(move)
        game_state['redo_stack'].clear()  # Clear redo stack on new move
        
        # Apply move
        if move_type == 'number':
            game_state['current_board'][row][col] = value
        elif move_type == 'note':
            if value in game_state['notes'][row][col]:
                game_state['notes'][row][col].remove(value)
            else:
                game_state['notes'][row][col].append(value)
                game_state['notes'][row][col].sort()
        
        # Check for completion
        is_complete = sudoku_solver.is_complete(game_state['current_board'])
        is_valid = sudoku_solver.is_valid_board(game_state['current_board'])
        
        if is_complete and is_valid:
            game_state['is_completed'] = True
            # Update user stats
            user_id = game_state['user_id']
            stats = get_user_stats(user_id)
            stats['total_games'] += 1
            stats['completed_games'] += 1
            stats['last_played'] = datetime.now().isoformat()
            save_user_stats(user_id, stats)
        
        return jsonify({
            'success': True,
            'move': move,
            'is_complete': is_complete,
            'is_valid': is_valid,
            'current_board': game_state['current_board'],
            'notes': game_state['notes']
        })
    except Exception as e:
        logger.error(f"Error making move: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to make move. Please try again.'
        }), 500

@app.route('/api/undo', methods=['POST'])
def undo_move():
    """Undo the last move"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        
        if not game_state['moves_history']:
            return jsonify({'success': False, 'error': 'No moves to undo'}), 400
        
        # Get last move
        last_move = game_state['moves_history'].pop()
        
        # Add to redo stack
        game_state['redo_stack'].append(last_move)
        
        # Undo the move
        row, col = last_move['row'], last_move['col']
        if last_move['move_type'] == 'number':
            game_state['current_board'][row][col] = last_move['old_value']
        elif last_move['move_type'] == 'note':
            game_state['notes'][row][col] = last_move['old_notes'][:]
        
        return jsonify({
            'success': True,
            'undone_move': last_move,
            'current_board': game_state['current_board'],
            'notes': game_state['notes']
        })
    except Exception as e:
        logger.error(f"Error undoing move: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to undo move. Please try again.'
        }), 500

@app.route('/api/redo', methods=['POST'])
def redo_move():
    """Redo the last undone move"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        
        if not game_state['redo_stack']:
            return jsonify({'success': False, 'error': 'No moves to redo'}), 400
        
        # Get move to redo
        move_to_redo = game_state['redo_stack'].pop()
        
        # Add back to history
        game_state['moves_history'].append(move_to_redo)
        
        # Apply the move
        row, col = move_to_redo['row'], move_to_redo['col']
        if move_to_redo['move_type'] == 'number':
            game_state['current_board'][row][col] = move_to_redo['new_value']
        elif move_to_redo['move_type'] == 'note':
            game_state['notes'][row][col] = move_to_redo['new_notes'] if 'new_notes' in move_to_redo else [move_to_redo['new_value']]
        
        return jsonify({
            'success': True,
            'redone_move': move_to_redo,
            'current_board': game_state['current_board'],
            'notes': game_state['notes']
        })
    except Exception as e:
        logger.error(f"Error redoing move: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to redo move. Please try again.'
        }), 500

@app.route('/api/hint', methods=['POST'])
def get_hint():
    """Get a hint for a specific cell"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        row = data.get('row', 0)
        col = data.get('col', 0)
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        
        if row < 0 or row >= 9 or col < 0 or col >= 9:
            return jsonify({'success': False, 'error': 'Invalid cell position'}), 400
        
        if game_state['puzzle'][row][col] != 0:
            return jsonify({'success': False, 'error': 'Cannot get hint for original cells'}), 400
        
        # Get hint value
        hint_value = game_state['solution'][row][col]
        
        # Update game state
        game_state['hints_used'] += 1
        
        return jsonify({
            'success': True,
            'hint': hint_value,
            'position': {'row': row, 'col': col},
            'hints_used': game_state['hints_used']
        })
    except Exception as e:
        logger.error(f"Error getting hint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get hint. Please try again.'
        }), 500

@app.route('/api/check-solution', methods=['POST'])
def check_solution():
    """Check if the current board state is valid"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        board = game_state['current_board']
        
        # Check if the board is valid
        is_valid = sudoku_solver.is_valid_board(board)
        
        # Get detailed validation info
        validation_details = sudoku_solver.get_validation_details(board)
        
        return jsonify({
            'success': True,
            'is_valid': is_valid,
            'details': validation_details
        })
    except Exception as e:
        logger.error(f"Error checking solution: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to check solution. Please try again.'
        }), 500

@app.route('/api/solve', methods=['POST'])
def solve_puzzle():
    """Solve the current puzzle"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        board = game_state['current_board']
        
        # Solve the puzzle
        solution = sudoku_solver.solve(board)
        
        if solution:
            return jsonify({
                'success': True,
                'solution': solution
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Puzzle cannot be solved'
            }), 400
    except Exception as e:
        logger.error(f"Error solving puzzle: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to solve puzzle. Please try again.'
        }), 500

@app.route('/api/game-stats', methods=['POST'])
def save_game_stats():
    """Save game statistics"""
    try:
        data = request.get_json()
        game_id = data.get('game_id')
        time_taken = data.get('time_taken', 0)
        completed = data.get('completed', False)
        
        if not game_id or game_id not in game_states:
            return jsonify({'success': False, 'error': 'Invalid game ID'}), 400
        
        game_state = game_states[game_id]
        user_id = game_state['user_id']
        stats = get_user_stats(user_id)
        
        # Update statistics
        stats['total_games'] += 1
        if completed:
            stats['completed_games'] += 1
            difficulty = game_state['difficulty']
            if difficulty not in stats['best_times']:
                stats['best_times'][difficulty] = time_taken
            else:
                stats['best_times'][difficulty] = min(stats['best_times'][difficulty], time_taken)
        
        stats['total_play_time'] += time_taken
        stats['hints_used'] += game_state['hints_used']
        stats['notes_used'] += game_state['notes_used']
        stats['last_played'] = datetime.now().isoformat()
        
        save_user_stats(user_id, stats)
        
        return jsonify({
            'success': True,
            'message': 'Game statistics saved',
            'stats': stats
        })
    except Exception as e:
        logger.error(f"Error saving game stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to save game statistics'
        }), 500

@app.route('/api/user-stats', methods=['GET'])
def get_user_statistics():
    """Get user statistics"""
    try:
        user_id = get_user_id()
        stats = get_user_stats(user_id)
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get user statistics'
        }), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get leaderboard data"""
    try:
        # In a real app, this would query a database
        # For now, return mock data
        leaderboard = [
            {'user_id': 'user1', 'name': 'Player 1', 'score': 1500, 'completed_games': 25},
            {'user_id': 'user2', 'name': 'Player 2', 'score': 1200, 'completed_games': 20},
            {'user_id': 'user3', 'name': 'Player 3', 'score': 1000, 'completed_games': 15},
        ]
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard
        })
    except Exception as e:
        logger.error(f"Error getting leaderboard: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get leaderboard'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Enhanced Sudoku game server is running',
        'version': '3.0.0',
        'timestamp': time.time(),
        'active_games': len(game_states),
        'active_users': len(user_stats)
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    
    print("🎮 Starting Enhanced Sudoku Game Server v3.0...")
    print("=" * 60)
    print(f"🌐 Local Access: http://localhost:{port}")
    print(f"🌐 LAN Access:   http://{local_ip}:{port}")
    print(f"🔧 Debug Mode:   {'ON' if debug_mode else 'OFF'}")
    print(f"📊 Version:      3.0.0")
    print(f"🎯 Features:     Multiple Game Modes, Notes, Undo/Redo")
    print(f"📱 PWA Ready:    Yes")
    print("=" * 60)
    print("📱 Share the LAN URL with other devices on your network!")
    print("⏹️  Press Ctrl+C to stop the server")
    print("-" * 60)
    
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
    