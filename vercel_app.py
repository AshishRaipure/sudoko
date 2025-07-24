#!/usr/bin/env python3
"""
Vercel-compatible Flask app for Sudoku Game
Optimized for serverless deployment
"""

import os
import sys
from flask import Flask, render_template, request, jsonify
from sudoku_solver import SudokuSolver

# Create Flask app
app = Flask(__name__)

# Configure for production
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['FLASK_ENV'] = os.environ.get('FLASK_ENV', 'production')

# Initialize Sudoku solver
solver = SudokuSolver()

@app.route('/')
def index():
    """Main game page"""
    return render_template('index.html')

@app.route('/api/new-game', methods=['POST'])
def new_game():
    """Generate new Sudoku puzzle"""
    try:
        data = request.get_json() or {}
        difficulty = data.get('difficulty', 'medium')
        
        # Generate puzzle
        puzzle, solution = solver.generate_puzzle(difficulty)
        
        return jsonify({
            'success': True,
            'puzzle': puzzle,
            'solution': solution,
            'difficulty': difficulty
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/check-solution', methods=['POST'])
def check_solution():
    """Check if the current board is correct"""
    try:
        data = request.get_json()
        if not data or 'board' not in data:
            return jsonify({'success': False, 'error': 'Board data required'}), 400
        
        board = data['board']
        
        # Check if board is complete and correct
        if solver.is_valid_solution(board):
            return jsonify({
                'success': True,
                'correct': True,
                'message': 'Congratulations! You solved the puzzle!'
            })
        else:
            return jsonify({
                'success': True,
                'correct': False,
                'message': 'Not quite right. Keep trying!'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/solve', methods=['POST'])
def solve_puzzle():
    """Auto-solve the current puzzle"""
    try:
        data = request.get_json()
        if not data or 'puzzle' not in data:
            return jsonify({'success': False, 'error': 'Puzzle data required'}), 400
        
        puzzle = data['puzzle']
        solution = solver.solve(puzzle)
        
        if solution:
            return jsonify({
                'success': True,
                'solution': solution
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Could not solve puzzle'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/hint', methods=['POST'])
def get_hint():
    """Get a hint for the current puzzle"""
    try:
        data = request.get_json()
        if not data or 'puzzle' not in data or 'board' not in data:
            return jsonify({'success': False, 'error': 'Puzzle and board data required'}), 400
        
        puzzle = data['puzzle']
        board = data['board']
        
        # Find an empty cell and provide the correct number
        for i in range(9):
            for j in range(9):
                if board[i][j] == 0:  # Empty cell
                    # Get the solution for this cell
                    solution = solver.solve(puzzle)
                    if solution and solution[i][j] != 0:
                        return jsonify({
                            'success': True,
                            'row': i,
                            'col': j,
                            'value': solution[i][j],
                            'message': f'Try {solution[i][j]} in row {i+1}, column {j+1}'
                        })
        
        return jsonify({
            'success': False,
            'error': 'No hints available'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Sudoku Game API is running',
        'creator': 'Ashish Raipure 2025'
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# For local development
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 