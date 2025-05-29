import { connectMySQL } from "../data-access/connection";
import { GameGateway } from "../data-access/gameGateway";
import { SquareGateway } from "../data-access/squareGateway";
import { TurnGateway } from "../data-access/turnGateway";
import { DARK, INITIAL_BOARD } from "./constants";

const gameGateway = new GameGateway();
const turnGateway = new TurnGateway();
const squareGateway = new SquareGateway();

export class GameService {
  async startNewGame() {
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
  }
}
