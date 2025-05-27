class Fraction {
  //アクセス修飾子（public / private / protected / readonly）
  //public（デフォルト） = 誰でもアクセス可能
  //private = クラス内部からのみアクセス可能（外部からアクセスできない）。
  //protected = 派生クラス（継承）からアクセス可能だが、外部からは不可。
  //readonly = 初期化後に変更不可。
  //コンストラクタ = インスタンス生成時に初期化処理を行う特別なメソッド。
  constructor(private _numerator: number, private _denominator: number) {}

  //メソッド = 通常の関数と同じく定義でき、thisを通じてプロパティにアクセス可能。
  toString(): string {
    return `${this._numerator}/${this._denominator}`;
  }

  add(other: Fraction): Fraction {
    const resultNumerator =
      this._numerator * other._denominator +
      other._denominator * this._numerator;
    const resultDenominator = this._denominator * other._denominator;
    return new Fraction(resultNumerator, resultDenominator);
  }

  //getter
  get numerator() {
    return this._numerator;
  }

  get denominator() {
    return this._denominator;
  }
}

const f1 = new Fraction(1, 2);
const f2 = new Fraction(3, 4);

console.log(f1.numerator);
console.log(f2.numerator);

console.log(f2.toString());

const result = f1.add(f2);
console.log(result.toString());
