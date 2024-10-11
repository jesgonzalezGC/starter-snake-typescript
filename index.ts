import runServer from './server';
import { Battlesnake, Coord, GameState, InfoResponse, MoveResponse } from './types';

function info(): InfoResponse {
  console.log("INFO");

  return {
    apiversion: "1",
    author: "",
    color: "#2cb5b5",
    head: "bonhomme",
    tail: "bonhomme",
  };
}

function start(game_state: GameState): void {
  console.log("GAME START");
}

// end is called when your Battlesnake finishes a game
function end(game_state: GameState): void {
  console.log("GAME OVER\n");
}

enum EDirections {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right'
}

const DIRECTIONS_DATA = new Map<EDirections, Coord>([
  [EDirections.UP, { x: 0, y: 1 }],
  [EDirections.DOWN, { x: 0, y: -1 }],
  [EDirections.LEFT, { x: -1, y: 0 }],
  [EDirections.RIGHT, { x: 1, y: 0 }]
]);

// enum EPossibleGridValue {
//   EMPTY,
//   SNAKE_HEAD,
//   SNAKE_BODY
// }

function getBoardMatrix(data: { height: number, width: number, snakes: Array<Battlesnake>, food: Coord[] }): Array<Array<{ snake_id: number, body_position: number } | 0>> {
  console.log("\n**************");
  const matrix: Array<Array<{ snake_id: number, body_position: number } | 0>> = Array.from(Array(data.width), () => new Array(data.height).fill(0));
  for (const [snake_id, snake] of data.snakes.entries()) {
    for (const [position, snake_part] of snake.body.entries()) {
      matrix[snake_part.x][snake_part.y] = { snake_id: snake_id, body_position: position + 1 };
    }
  }
  // console.log("matrix", matrix);
  return matrix;
}

function getNerbyFoodCoord(game_data: GameState): false | Coord {
  const my_head = game_data.you.head;
  let nerby_food_coord: false | Coord = false;
  let nerby_food_distance = game_data.board.width + game_data.board.height;
  for (const food_coord of game_data.board.food) {
    const distance_x = Math.abs(food_coord.x - my_head.x);
    const distance_y = Math.abs(food_coord.y - my_head.y);
    if (nerby_food_distance > distance_x + distance_y) {
      nerby_food_distance = distance_x + distance_y;
      nerby_food_coord = food_coord;
      if (nerby_food_distance <= 1) {
        break;
      }
    }
  }
  return nerby_food_coord;
}

function sumarCoords(coord_a: Coord, coord_b: Coord): Coord {
  return {
    x: coord_a.x + coord_b.x,
    y: coord_a.y + coord_b.y
  }
}

function isSafeLocation(matrix: Array<Array<{ snake_id: number, body_position: number } | 0>>, coord: Coord): boolean {
  const col_values = matrix[coord.x];
  if (!col_values) {
    return false;
  }
  const value = col_values[coord.y];
  if (value == undefined) {
    return false;
  }
  return value == 0;
  //TODO add more validations here
  // - Add validation for next turn stuck
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSafeDirections(matrix: Array<Array<{ snake_id: number, body_position: number } | 0>>, my_head: Coord, nerby_food_coord: false | Coord): Array<EDirections> {
  const safe_positions = new Map<EDirections, boolean>([
    [EDirections.UP, false],
    [EDirections.DOWN, false],
    [EDirections.LEFT, false],
    [EDirections.RIGHT, false]
  ]);

  if (!nerby_food_coord) {
    for (const [direction, direction_coord] of DIRECTIONS_DATA) {
      const new_coord = sumarCoords(my_head, direction_coord);
      if (!isSafeLocation(matrix, new_coord)) {
        safe_positions.delete(direction);
      }
    }
    return Array.from(safe_positions.keys());
  }
  
  const intended_direction: Coord = {
    x: clamp(nerby_food_coord.x - my_head.x, -1, 1),
    y: clamp(nerby_food_coord.y - my_head.y, -1, 1)
  };
  for (const [direction, direction_coord] of DIRECTIONS_DATA) {
    const new_coord = sumarCoords(my_head, direction_coord);
    if (!isSafeLocation(matrix, new_coord)) {
      safe_positions.delete(direction);
      continue;
    }
    safe_positions.set(direction, getMovementPriority(intended_direction, direction_coord));
  }
  const final_result = Array.from(safe_positions.entries()).map(([direction, priority], index) => {
    if (priority) {
      return direction;
    }
    return false;
  }).filter(element => element) as Array<EDirections>;
  return final_result.length > 0 ? final_result : Array.from(safe_positions.keys());
}

function getMovementPriority(intended_direction: Coord, direction_coord: Coord): boolean {
  const already_in_col = intended_direction.x == 0;
  const already_in_row = intended_direction.y == 0;

  if (already_in_col && direction_coord.x != 0) {
    return false;
  }
  if (already_in_row && direction_coord.y != 0) {
    return false;
  }
  if (!already_in_col && direction_coord.x != 0) {
    return intended_direction.x - direction_coord.x == 0;
  }
  if (!already_in_row && direction_coord.y != 0) {
    return intended_direction.y - direction_coord.y == 0
  }
  return true;
}

function getAllValidMovements(game_data: GameState, matrix: Array<Array<{ snake_id: number, body_position: number } | 0>>): Array<EDirections> {
  const nerby_food_coord = getNerbyFoodCoord(game_data);
  const my_head = game_data.you.head;
  const safe_positions = getSafeDirections(matrix, my_head, nerby_food_coord);
  return safe_positions;
}

function move(game_data: GameState): MoveResponse {
  const game_matrix = getBoardMatrix({
    height: game_data.board.height,
    width: game_data.board.width,
    snakes: game_data.board.snakes,
    food: game_data.board.food
  });

  const safe_movements = getAllValidMovements(game_data, game_matrix);

  if (safe_movements.length == 0) {
    console.log(`MOVE ${game_data.turn}: No safe moves detected! Moving down`);
    return { move: "down" };
  }
  const next_move = Array.from(safe_movements)[Math.floor(Math.random() * safe_movements.length)];
  console.log(`MOVE ${game_data.turn}: ${next_move}`)
  return { move: next_move };
}

runServer({
  info: info,
  start: start,
  move: move,
  end: end
});
