import express from "express";
//ロギングミドルウェア
//にHTTPリクエストをログとして記録するために利用
import morgan from "morgan";
import { gameRouter } from "./presentation/gameRouter.js";
import { turnRouter } from "./presentation/turnRouter.js";

const PORT = 3000;

const app = express();

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

app.use(morgan("dev"));
app.use(express.json());
app.use(
  express.static("static", {
    extensions: ["html"],
  })
);
app.use(gameRouter);
app.use(turnRouter);

app.listen(PORT, () => {
  console.log(`Reversi application started: http://localhost:${PORT}`);
});
