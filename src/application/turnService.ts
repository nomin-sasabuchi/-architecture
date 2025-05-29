import { connectMySQL } from "../data-access/connection";
import { GameGateway } from "../data-access/gameGateway";
import { MoveGateway } from "../data-access/moveGateway";
import { SquareGateway } from "../data-access/squareGateway";
import { TurnGateway } from "../data-access/turnGateway";
import { DARK, LIGHT } from "./constants";

const gameGateway = new GameGateway();
const turnGateway = new TurnGateway();
const moveGateway = new MoveGateway();
const squareGateway = new SquareGateway();

export class TurnService {
  async findLatestGameTurnByTurnCount(turnCount: number) {
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

      return {
        turnCount,
        board,
        nextDisc: turnRecord.nextDisc,
        // TODO 決着がついている場合、game_results テーブルから取得する
        winnerDisc: null,
      };
    } finally {
      await conn.end();
    }
  }
  async registerTurn(turnCount: number, disc: number, x: number, y: number) {
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
  }
}
