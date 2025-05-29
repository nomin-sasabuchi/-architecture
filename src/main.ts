import express from "express";
//ロギングミドルウェア
//にHTTPリクエストをログとして記録するために利用
import morgan from "morgan";
import mysql from "mysql2/promise";
import { GameGateway } from "./data-access/gameGateway.js";
import { TurnGateway } from "./data-access/turnGateway.js";
import { MoveGateway } from "./data-access/moveGateway.js";
import { SquareGateway } from "./data-access/squareGateway.js";

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
const turnGateway = new TurnGateway();
const moveGateway = new MoveGateway();
const squareGateway = new SquareGateway();
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
    const turnRecord = await turnGateway.insert(
      conn,
      gameRecord.id,
      0,
      DARK,
      now
    );

    //
    await squareGateway.insertAll(conn, turnRecord.id, INITIAL_BOARD);

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
    const turnRecord = await await turnGateway.findForGameIdAndTurnCount(
      conn,
      gameRecord.id,
      turnCount
    );
    if (!turnRecord) {
      throw new Error("Specified turn found");
    }

    const squareRecords = await await squareGateway.findForTurnId(
      conn,
      turnRecord.id
    );
    if (!squareRecords) {
      throw new Error("Latest squareGRecord not found");
    }
    //

    const board = Array.from(Array(8)).map(() => Array.from(Array(8)));
    squareRecords.forEach((s) => {
      board[s.y][s.x] = s.disc;
    });

    const responseBody = {
      turnCount,
      board,
      nextDisc: turnRecord.nextDisc,
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
    const previousTurnRecord =
      await await turnGateway.findForGameIdAndTurnCount(
        conn,
        gameRecord.id,
        previousTurnCount
      );
    if (!previousTurnRecord) {
      throw new Error("Specified turn found");
    }

    const squareRecords = await await squareGateway.findForTurnId(
      conn,
      previousTurnRecord.id
    );
    if (!squareRecords) {
      throw new Error("Latest squareGRecord not found");
    }

    const board = Array.from(Array(8)).map(() => Array.from(Array(8)));
    squareRecords.forEach((s) => {
      board[s.y][s.x] = s.disc;
    });

    // TODO 盤面に置けるかチェック

    // 石を置く
    board[y][x] = disc;

    // TODO ひっくり返す

    // ターンを保存する
    const nextDisc = disc === DARK ? LIGHT : DARK;
    const now = new Date();
    const turnRecord = await turnGateway.insert(
      conn,
      gameRecord.id,
      turnCount,
      nextDisc,
      now
    );
    if (!turnRecord) {
      throw new Error("Specified turn found");
    }

    await squareGateway.insertAll(conn, turnRecord.id, board);
    await moveGateway.insert(conn, turnRecord.id, disc, x, y);

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
