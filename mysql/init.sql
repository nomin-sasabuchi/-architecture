drop database if exists reversi;

create database reversi;

use reversi;

-- ゲーム開始情報
create table games (
  --  ゲームの識別子
  id int primary key auto_increment,
  -- ゲームが開始された日時
  started_at datetime not null
);

-- 各ターンのメタ情報（誰の番か・いつ終わったか）
create table turns (
  id int primary key auto_increment,
  -- 所属ゲーム
  game_id int not null,
  -- 何ターン目か（1, 2, 3...）
  turn_count int not null,
  -- 次に打つプレイヤー（黒=1, 白=2など）
  next_disc int,
  -- ターン終了時刻
  end_at datetime not null,
  --  gamesと紐づけ
  foreign key (game_id) references games (id),
  --  1つのゲーム内で重複ターンを防ぐ
  unique (game_id, turn_count)
);

-- 各ターンの手（誰がどこに打ったか）
create table moves (
  -- 
  id int primary key auto_increment,
  -- 該当ターン
  turn_id int not null,
  -- 打ったプレイヤー（1=黒、2=白）
  disc int not null,
  -- 盤面の座標
  x int not null,
  y int not null,
  -- turnsと紐づけ
  foreign key (turn_id) references turns (id)
);

-- 各ターン終了時の 盤面の状態（squares）
create table squares (
  -- 
  id int primary key auto_increment,
  -- 該当ターン
  turn_id int not null,
  -- 盤面座標
  x int not null,
  y int not null,
  -- そのマスに置かれている石（0=なし、1=黒、2=白）
  disc int not null,
  -- turnsと紐づけ
  foreign key (turn_id) references turns (id),
  --  同一ターン・同一座標の重複を防ぐ
  unique (turn_id, x, y)
);

-- 勝者・終了時間の記録
create table game_results (
  -- 
  id int primary key auto_increment,
  -- 
  game_id int not null,
  -- 勝者の石の色（1=黒、2=白）
  winner_disc int not null,
  -- 終了時刻
  end_at datetime not null,
  --  gamesと紐づけ
  foreign key (game_id) references games (id)
);

select "ok" as result;