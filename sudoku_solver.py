import random
import copy
import hashlib

class SudokuSolver:
    def __init__(self):
        self.size = 9
        self.box_size = 3
        
    def generate_puzzle(self, difficulty='medium'):
        """
        Generate a new Sudoku puzzle with specified difficulty
        Returns: (puzzle, solution)
        """
        # Create a solved board first
        solution = self._create_solved_board()
        
        # Create puzzle by removing numbers based on difficulty
        puzzle = self._create_puzzle_from_solution(solution, difficulty)
        
        return puzzle, solution
    
    def generate_puzzle_with_seed(self, seed, difficulty='medium'):
        """
        Generate a new Sudoku puzzle with a specific seed for reproducibility
        Returns: (puzzle, solution)
        """
        # Create a hash from the seed for consistent random generation
        seed_hash = int(hashlib.md5(seed.encode()).hexdigest(), 16)
        random.seed(seed_hash)
        
        # Generate puzzle
        puzzle, solution = self.generate_puzzle(difficulty)
        
        # Reset random seed
        random.seed()
        
        return puzzle, solution
    
    def _create_solved_board(self):
        """Create a valid solved Sudoku board"""
        board = [[0 for _ in range(self.size)] for _ in range(self.size)]
        
        # Fill diagonal 3x3 boxes first (these are independent)
        for i in range(0, self.size, self.box_size):
            self._fill_box(board, i, i)
        
        # Solve the rest of the board
        self._solve_board(board)
        
        return board
    
    def _fill_box(self, board, row, col):
        """Fill a 3x3 box with random numbers"""
        numbers = list(range(1, 10))
        random.shuffle(numbers)
        
        for i in range(self.box_size):
            for j in range(self.box_size):
                board[row + i][col + j] = numbers.pop()
    
    def _solve_board(self, board):
        """Solve the Sudoku board using backtracking"""
        empty_cell = self._find_empty(board)
        if not empty_cell:
            return True
        
        row, col = empty_cell
        
        for num in range(1, 10):
            if self._is_valid_move(board, row, col, num):
                board[row][col] = num
                
                if self._solve_board(board):
                    return True
                
                board[row][col] = 0
        
        return False
    
    def _find_empty(self, board):
        """Find an empty cell in the board"""
        for i in range(self.size):
            for j in range(self.size):
                if board[i][j] == 0:
                    return (i, j)
        return None
    
    def _is_valid_move(self, board, row, col, num):
        """Check if placing num at (row, col) is valid"""
        # Check row
        for j in range(self.size):
            if board[row][j] == num:
                return False
        
        # Check column
        for i in range(self.size):
            if board[i][col] == num:
                return False
        
        # Check 3x3 box
        box_row = (row // self.box_size) * self.box_size
        box_col = (col // self.box_size) * self.box_size
        
        for i in range(box_row, box_row + self.box_size):
            for j in range(box_col, box_col + self.box_size):
                if board[i][j] == num:
                    return False
        
        return True
    
    def _create_puzzle_from_solution(self, solution, difficulty):
        """Create a puzzle by removing numbers from the solution"""
        puzzle = copy.deepcopy(solution)
        
        # Define number of cells to remove based on difficulty
        difficulty_levels = {
            'easy': 30,      # Remove 30 numbers
            'medium': 40,    # Remove 40 numbers
            'hard': 50,      # Remove 50 numbers
            'expert': 60     # Remove 60 numbers
        }
        
        cells_to_remove = difficulty_levels.get(difficulty, 40)
        
        # Randomly remove cells
        positions = [(i, j) for i in range(self.size) for j in range(self.size)]
        random.shuffle(positions)
        
        for i, j in positions[:cells_to_remove]:
            puzzle[i][j] = 0
        
        return puzzle
    
    def solve(self, board):
        """
        Solve a Sudoku puzzle
        Returns: solved board or None if unsolvable
        """
        board_copy = copy.deepcopy(board)
        
        if self._solve_board(board_copy):
            return board_copy
        return None
    
    def is_valid_board(self, board):
        """
        Check if the current board state is valid (no conflicts)
        Returns: True if valid, False otherwise
        """
        # Check rows
        for row in board:
            numbers = [x for x in row if x != 0]
            if len(numbers) != len(set(numbers)):
                return False
        
        # Check columns
        for col in range(self.size):
            numbers = [board[row][col] for row in range(self.size) if board[row][col] != 0]
            if len(numbers) != len(set(numbers)):
                return False
        
        # Check 3x3 boxes
        for box_row in range(0, self.size, self.box_size):
            for box_col in range(0, self.size, self.box_size):
                numbers = []
                for i in range(box_row, box_row + self.box_size):
                    for j in range(box_col, box_col + self.box_size):
                        if board[i][j] != 0:
                            numbers.append(board[i][j])
                if len(numbers) != len(set(numbers)):
                    return False
        
        return True
    
    def is_complete(self, board):
        """
        Check if the board is completely filled
        Returns: True if complete, False otherwise
        """
        for row in board:
            if 0 in row:
                return False
        return True
    
    def get_available_numbers(self, board, row, col):
        """
        Get available numbers for a specific cell
        Returns: list of available numbers
        """
        available = []
        for num in range(1, 10):
            if self._is_valid_move(board, row, col, num):
                available.append(num)
        return available
    
    def is_valid_move(self, board, row, col, num):
        """
        Check if placing num at (row, col) is valid
        Returns: True if valid, False otherwise
        """
        return self._is_valid_move(board, row, col, num)
    
    def get_validation_details(self, board):
        """
        Get detailed validation information for the board
        Returns: dictionary with validation details
        """
        details = {
            'rows_valid': True,
            'columns_valid': True,
            'boxes_valid': True,
            'conflicts': []
        }
        
        # Check rows
        for row_idx, row in enumerate(board):
            numbers = [x for x in row if x != 0]
            if len(numbers) != len(set(numbers)):
                details['rows_valid'] = False
                details['conflicts'].append(f'Row {row_idx + 1} has duplicate numbers')
        
        # Check columns
        for col_idx in range(self.size):
            numbers = [board[row][col_idx] for row in range(self.size) if board[row][col_idx] != 0]
            if len(numbers) != len(set(numbers)):
                details['columns_valid'] = False
                details['conflicts'].append(f'Column {col_idx + 1} has duplicate numbers')
        
        # Check 3x3 boxes
        for box_row in range(0, self.size, self.box_size):
            for box_col in range(0, self.size, self.box_size):
                numbers = []
                for i in range(box_row, box_row + self.box_size):
                    for j in range(box_col, box_col + self.box_size):
                        if board[i][j] != 0:
                            numbers.append(board[i][j])
                if len(numbers) != len(set(numbers)):
                    details['boxes_valid'] = False
                    box_num = (box_row // self.box_size) * 3 + (box_col // self.box_size) + 1
                    details['conflicts'].append(f'Box {box_num} has duplicate numbers')
        
        details['is_valid'] = details['rows_valid'] and details['columns_valid'] and details['boxes_valid']
        return details
    
    def get_puzzle_difficulty_rating(self, puzzle):
        """
        Calculate a difficulty rating for a puzzle based on solving techniques required
        Returns: difficulty rating (1-10)
        """
        # This is a simplified difficulty calculation
        # In a real implementation, you'd analyze the solving techniques required
        
        empty_cells = sum(1 for row in puzzle for cell in row if cell == 0)
        
        # Base difficulty on empty cells
        if empty_cells <= 30:
            return 1  # Very Easy
        elif empty_cells <= 40:
            return 3  # Easy
        elif empty_cells <= 50:
            return 5  # Medium
        elif empty_cells <= 60:
            return 7  # Hard
        else:
            return 9  # Expert
    
    def get_solving_hints(self, board, row, col):
        """
        Get solving hints for a specific cell
        Returns: list of hints
        """
        hints = []
        
        if board[row][col] != 0:
            return hints  # Cell is already filled
        
        available = self.get_available_numbers(board, row, col)
        
        if len(available) == 1:
            hints.append(f"Only {available[0]} can go in this cell")
        elif len(available) == 2:
            hints.append(f"Only {available[0]} or {available[1]} can go in this cell")
        elif len(available) <= 3:
            hints.append(f"Only {', '.join(map(str, available))} can go in this cell")
        
        return hints 