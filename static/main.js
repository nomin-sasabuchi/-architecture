const EMPTY = 0;
const DARK = 1;
const LIGHT = 2;

const boardElement = document.getElementById("board");

//盤面の描画処理
async function showBoard(turnCount = 0) {
  const response = await fetch(`/api/games/latest/turns/${turnCount}`);
  const responseBody = await response.json();
  const board = responseBody.board;
  const nextDisc = responseBody.nextDisc;
  //前の表示をすべてクリア
  while (boardElement.firstChild) {
    boardElement.removeChild(boardElement.firstChild);
  }

  //INITIAL_BOARD の内容に応じて HTML を動的に生成
  board.forEach((line, y) => {
    line.forEach((square, x) => {
      // <div class="square">
      const squareElement = document.createElement("div");
      squareElement.className = "square";

      //マスに石が置かれていればその石（div）を追加
      if (square !== EMPTY) {
        // <div class="stone dark">
        const stoneElement = document.createElement("div");
        const color = square === DARK ? "dark" : "light";
        stoneElement.className = `stone ${color}`;

        squareElement.appendChild(stoneElement);
      } else {
        squareElement.addEventListener("click", async () => {
          const nextTurnCount = turnCount + 1;
          await registerTurn(nextTurnCount, nextDisc, x, y);
          await showBoard(nextTurnCount);
        });
      }

      //そのマスを盤面に追加
      boardElement.appendChild(squareElement);
    });
  });
}

//ゲームをバックエンドに登録（新規作成）するためのPOSTリクエスト
async function registerGame(params) {
  await fetch("/api/games", {
    method: "POST",
  });
}

//ターンの登録
async function registerTurn(turnCount, disc, x, y) {
  const requestBody = {
    turnCount,
    move: {
      disc,
      x,
      y,
    },
  };

  await fetch("/api/games/latest/turns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
}

//アプリの起動処理
async function main() {
  await registerGame();
  await showBoard(0);
}

main();
