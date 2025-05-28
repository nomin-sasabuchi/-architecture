import mysql from "mysql2/promise";
import { GameRecord } from "./gameRecord";

export class GameGateway {
  async findLatest(conn: mysql.Connection): Promise<GameRecord | undefined> {
    //ゲームから id、started_at を選択し、id で並べ替え、desc で制限を 1 に設定します。(最新の対戦を取得)
    const gameSelectResult = await conn.execute<mysql.RowDataPacket[]>(
      "select id, started_at from games order by id desc limit 1"
    );
    const record = gameSelectResult[0][0];

    if (!record) {
      return undefined;
    }
    return new GameRecord(record["id"], record["started_at"]);
  }
  async insert(conn: mysql.Connection, startedAt: Date): Promise<GameRecord> {
    const gameInsertResult = await conn.execute<mysql.ResultSetHeader>(
      "insert into games (started_at) values (?)",
      [startedAt]
    );
    const gameId = gameInsertResult[0].insertId;

    return new GameRecord(gameId, startedAt);
  }
}
