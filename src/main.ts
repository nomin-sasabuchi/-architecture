import express from "express";
//ロギングミドルウェア
//にHTTPリクエストをログとして記録するために利用
import morgan from "morgan";
import mysql from "mysql2/promise";
import { GameGateway } from "./gameGateway.js";

const PORT = 3000;

const app = express();

const EMPTY = 0;
const DARK = 1;
const LIGHT = 2;

/**
 * ゲーム開始時のオセロボードの初期状態を表す2次元配列。
 *
 * 各要素はボード上のセルを表し、`EMPTY`（空き）、`DARK`（黒石）、`LIGHT`（白石）のいずれかの値を持つ。
 *
 * - 配列は8x8の正方形で、オセロの標準的なボードサイズに対応している。
 * - すべてのセルは初期状態で`EMPTY`（空き）に設定されているが、中央4マスのみ
 *   - [3][3]：`DARK`（黒石）
 *   - [3][4]：`LIGHT`（白石）
 *   - [4][3]：`LIGHT`（白石）
 *   - [4][4]：`DARK`（黒石）
 *   となっており、オセロの開始配置に従っている。
 *
 * @constant
 * @type {number[][]}
 * @example
 * // ボードの初期状態を参照する
 * console.log(INITIAL_BOARD[3][3]); // DARK
 */
const INITIAL_BOARD = [
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, DARK, LIGHT, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, LIGHT, DARK, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
];

//ログ出力
app.use(morgan("dev"));

app.use(express.json());

app.use(
  express.static("static", {
    extensions: ["html"],
  })
);

const gameGateway = new GameGateway();
//
app.post("/api/games", async (req, res) => {
  const now = new Date();

  //DBの接続
  const conn = await connectMySQL();
  try {
    //複数のクエリを1つのまとまりとして実行し、成功すればコミット、失敗すればロールバックする
    await conn.beginTransaction();

    //SQL文をプレースホルダー付きで書き、配列で値を渡す
    const gameRecord = await gameGateway.insert(conn, now);

    // ターンの挿入
    const turnInsertResult = await conn.execute<mysql.ResultSetHeader>(
      "insert into turns (game_id, turn_count, next_disc, end_at) values (?, ?, ?, ?)",
      [gameRecord.id, 0, DARK, now]
    );
    const turnId = turnInsertResult[0].insertId;

    //盤面のマスの数
    const squareCount = INITIAL_BOARD.map((line) => line.length).reduce(
      (v1, v2) => v1 + v2,
      0
    );

    //
    const squaresInsertSql =
      "insert into squares (turn_id, x, y, disc) values " +
      Array.from(Array(squareCount))
        .map(() => "(?, ?, ?, ?)")
        .join(", ");

    const squaresInsertValues: any[] = [];
    INITIAL_BOARD.forEach((line, y) => {
      line.forEach((disc, x) => {
        squaresInsertValues.push(turnId);
        squaresInsertValues.push(x);
        squaresInsertValues.push(y);
        squaresInsertValues.push(disc);
      });
    });

    console.log("squaresInsertSql", squaresInsertSql);
    console.log("squaresInsertValues", squaresInsertValues);

    await conn.execute(squaresInsertSql, squaresInsertValues);

    await conn.commit();
  } finally {
    await conn.end();
  }

  res.status(201).end();
});

//盤面を取得
app.get("/api/games/latest/turns/:turnCount", async (req, res) => {
  const turnCount = parseInt(req.params.turnCount);

  const conn = await connectMySQL();
  try {
    //ゲームから id、started_at を選択し、id で並べ替え、desc で制限を 1 に設定します。(最新の対戦を取得)
    const gameRecord = await await gameGateway.findLatest(conn);
    if (!gameRecord) {
      throw new Error("Latest game not found");
    }

    //game_id = ? かつ turn_count = ? の場合、turns から id、game_id、turn_count、next_disc、end_at を選択します。
    const turnSelectResult = await conn.execute<mysql.RowDataPacket[]>(
      "select id, game_id, turn_count, next_disc, end_at from turns where game_id = ? and turn_count = ?",
      [gameRecord.id, turnCount]
    );
    const turn = turnSelectResult[0][0];

    //
    const squaresSelectResult = await conn.execute<mysql.RowDataPacket[]>(
      `select id, turn_id, x, y, disc from squares where turn_id = ?`,
      [turn["id"]]
    );
    const squares = squaresSelectResult[0];
    const board = Array.from(Array(8)).map(() => Array.from(Array(8)));
    squares.forEach((s) => {
      board[s.y][s.x] = s.disc;
    });

    const responseBody = {
      turnCount,
      board,
      nextDisc: turn["next_disc"],
      // TODO 決着がついている場合、game_results テーブルから取得する
      winnerDisc: null,
    };
    res.json(responseBody);
  } finally {
    await conn.end();
  }
});

app.post("/api/games/latest/turns", async (req, res) => {
  const turnCount = parseInt(req.body.turnCount);
  const disc = parseInt(req.body.move.disc);
  const x = parseInt(req.body.move.x);
  const y = parseInt(req.body.move.y);

  const conn = await connectMySQL();
  try {
    await conn.beginTransaction();

    // 1つ前のターンを取得する
    const gameRecord = await await gameGateway.findLatest(conn);
    if (!gameRecord) {
      throw new Error("Latest game not found");
    }

    const previousTurnCount = turnCount - 1;
    const turnSelectResult = await conn.execute<mysql.RowDataPacket[]>(
      "select id, game_id, turn_count, next_disc, end_at from turns where game_id = ? and turn_count = ?",
      [gameRecord.id, previousTurnCount]
    );
    const turn = turnSelectResult[0][0];

    const squaresSelectResult = await conn.execute<mysql.RowDataPacket[]>(
      `select id, turn_id, x, y, disc from squares where turn_id = ?`,
      [turn["id"]]
    );
    const squares = squaresSelectResult[0];
    const board = Array.from(Array(8)).map(() => Array.from(Array(8)));
    squares.forEach((s) => {
      board[s.y][s.x] = s.disc;
    });

    // TODO 盤面に置けるかチェック

    // 石を置く
    board[y][x] = disc;

    // TODO ひっくり返す

    // ターンを保存する
    const nextDisc = disc === DARK ? LIGHT : DARK;
    const now = new Date();
    const turnInsertResult = await conn.execute<mysql.ResultSetHeader>(
      "insert into turns (game_id, turn_count, next_disc, end_at) values (?, ?, ?, ?)",
      [gameRecord.id, turnCount, nextDisc, now]
    );
    const turnId = turnInsertResult[0].insertId;

    const squareCount = board
      .map((line) => line.length)
      .reduce((v1, v2) => v1 + v2, 0);

    const squaresInsertSql =
      "insert into squares (turn_id, x, y, disc) values " +
      Array.from(Array(squareCount))
        .map(() => "(?, ?, ?, ?)")
        .join(", ");

    const squaresInsertValues: any[] = [];
    board.forEach((line, y) => {
      line.forEach((disc, x) => {
        squaresInsertValues.push(turnId);
        squaresInsertValues.push(x);
        squaresInsertValues.push(y);
        squaresInsertValues.push(disc);
      });
    });

    await conn.execute(squaresInsertSql, squaresInsertValues);

    await conn.execute(
      "insert into moves (turn_id, disc, x, y) values (?, ?, ?, ?)",
      [turnId, disc, x, y]
    );

    await conn.commit();
  } finally {
    await conn.end();
  }

  res.status(201).end();
});

app.get("/api/error", async () => {
  throw new Error("Error endpoint");
});
// app.use((err, req, res, next) => {
//   console.error("Caught error:", err.message);
//   res.status(500).json({ error: err.message });
// });

app.listen(PORT, () => {
  console.log(`Reversi application started: http://localhost:${PORT}`);
});

//DBに接続
async function connectMySQL() {
  return await mysql.createConnection({
    host: "localhost",
    database: "reversi",
    user: "reversi",
    password: "password",
  });
}
