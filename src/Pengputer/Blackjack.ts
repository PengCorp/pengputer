import _ from "lodash";
import { classicColors } from "../Color/ansi";
import { Color } from "../Color/Color";
import { getCenteredString } from "../Toolbox/String";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

const INITIAL_CASH = 100;

const suits = ["hearts", "diamonds", "spades", "clubs"] as const;
const values = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
export type Suit = (typeof suits)[number];
export type Value = (typeof values)[number];

const valueScore: Record<Value, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

const suitDescriptors: Record<Suit, { fgColor: Color; symbol: string }> = {
  hearts: { fgColor: classicColors["red"], symbol: "♥︎" },
  diamonds: { fgColor: classicColors["red"], symbol: "♦︎" },
  spades: { fgColor: classicColors["black"], symbol: "♣︎" },
  clubs: { fgColor: classicColors["black"], symbol: "♠︎" },
};

interface Card {
  suit: Suit;
  value: Value;
  faceUp: boolean;
}

const getFreshDeck = () => {
  const freshDeck: Array<Card> = [];
  for (const suit of suits) {
    for (const value of values) {
      freshDeck.push({ suit, value, faceUp: false });
    }
  }
  return freshDeck;
};

const getScoreForCard = (card: Card) => {
  return valueScore[card.value];
};

class Hand {
  public cards: Card[];
  public bet: number;

  constructor() {
    this.cards = [];
    this.bet = 0;
  }

  public pushCard(card: Card) {
    this.cards.push(card);
  }
}

type PlayerStatus = "playing" | "blackjack" | "busted";

class Player {
  public cash: number;
  public hands: Hand[];
  public status: PlayerStatus;
  public isDealer: boolean;
  public name: string;

  constructor(name: string, isDealer: boolean) {
    this.cash = 0;
    this.hands = [];
    this.status = "playing";
    this.isDealer = isDealer;
    this.name = name;
  }

  public resetHand() {
    this.hands = [];
    this.status = "playing";
  }

  public revealInitialCards() {
    for (const h of this.hands) {
      for (const c of h.cards) {
        c.faceUp = true;
      }
      if (this.isDealer) {
        h.cards[h.cards.length - 1].faceUp = false;
      }
    }
  }

  public getHands() {
    return this.hands;
  }
}

export class Blackjack implements Executable {
  private pc: PC;
  private width: number;

  private isQuitting: boolean = false;

  private initialCash: number = 100;
  private deck: Array<Card> = [];
  private players: Array<Player> = [];
  private dealer: Player = new Player("Dealer", true);

  constructor(pc: PC) {
    this.pc = pc;
    this.width = this.pc.std.getConsoleSize().w;
  }

  private async readLine() {
    const { std } = this.pc;
    const result = (await std.readConsoleLine())?.trim().toLowerCase();
    if (result === "q" || result === "quit") {
      this.isQuitting = true;
    }
    return result;
  }

  private async askForBets() {
    const { std } = this.pc;

    for (let p = 0; p < this.players.length; p += 1) {
      const player = this.players[p];
      const hand = new Hand();
      player.hands.push(hand);

      hand.bet = 0;
      while (hand.bet === 0 || hand.bet > player.cash || hand.bet < 0) {
        std.writeConsole(
          `Player ${p + 1}, currently you have: $${player.cash}. Your bet? `
        );
        const betString = await this.readLine();
        if (this.isQuitting) return;
        const betValue = Number(betString);
        if (betValue) {
          hand.bet = betValue;
        }
      }
    }

    std.writeConsole("\n");
  }

  private async dealInitialCards() {
    const { std } = this.pc;

    this.deck = _.shuffle(getFreshDeck());

    for (const p of [...this.players, this.dealer]) {
      p.resetHand();
    }

    for (let j = 0; j < 2; j += 1) {
      for (const p of [...this.players, this.dealer]) {
        p.hands[0].pushCard(this.deck.pop()!);
      }
    }

    for (const p of [...this.players, this.dealer]) {
      p.revealInitialCards();
    }

    for (const p of [...this.players, this.dealer]) {
      std.writeConsole(`${_.padEnd(p.name, 9)}: `);
      this.printHand(p.getHands()[0].cards);
      std.writeConsole("\n");
    }
    std.writeConsole("\n");
  }

  private async askForNumberOfPlayers() {
    const { std } = this.pc;

    let numberOfPlayers = 0;
    while (numberOfPlayers <= 0 || numberOfPlayers > 7) {
      std.writeConsole("Number of players (1-7)? ");
      const numOfPlayersString = await this.readLine();
      if (this.isQuitting) return;
      numberOfPlayers = Number(numOfPlayersString);
    }

    for (let i = 0; i < numberOfPlayers; i += 1) {
      const player = new Player(`Player #${i + 1}`, false);
      player.cash = INITIAL_CASH;
      this.players.push(player);
    }

    std.writeConsole("\n");
  }

  private printCard(card: Card) {
    const { std } = this.pc;

    if (card.faceUp) {
      const bgColor = classicColors["white"];
      const fgColor = suitDescriptors[card.suit].fgColor;
      const suitSymbol = suitDescriptors[card.suit].symbol;
      const valueSymbol = _.padEnd(card.value, 2);

      std.writeConsole(` ${valueSymbol}${suitSymbol} `, { bgColor, fgColor });
      std.resetConsoleAttributes();
    } else {
      std.writeConsole(`☼☼☼☼☼`, {
        bgColor: classicColors["red"],
        fgColor: classicColors["white"],
      });
      std.resetConsoleAttributes();
    }
  }

  private printHand(hand: Array<Card>) {
    const { std } = this.pc;

    for (let c = 0; c < hand.length; c += 1) {
      this.printCard(hand[c]);
      std.writeConsole(" ");
    }
    std.writeConsole(`(${this.sumHand(hand)})`);
  }

  private sumHand(hand: Array<Card>, sumAll: boolean = false) {
    let acesAvailableToSubtract = 0;
    for (
      let i = 0;
      i < hand.length && hand[i].value === "A" && (sumAll || hand[i].faceUp);
      i += 1
    ) {
      acesAvailableToSubtract += 1;
    }

    let totalScore = 0;
    for (let i = 0; i < hand.length && hand[i].faceUp; i += 1) {
      totalScore += getScoreForCard(hand[i]);
    }

    while (totalScore > 21 && acesAvailableToSubtract > 0) {
      totalScore -= 10;
      acesAvailableToSubtract -= 1;
    }

    return totalScore;
  }

  private getIsBlackjack(hand: Array<Card>) {
    const sum = this.sumHand(hand, true);
    return sum === 21 && hand.length === 2;
  }

  async run(args: string[]) {
    const { std } = this.pc;

    std.resetConsole();
    std.clearConsole();

    std.writeConsole(
      " ".repeat((this.width - "Penger Casino presents...".length) / 2)
    );
    std.writeConsole("Penger Casino", { fgColor: classicColors["yellow"] });
    std.writeConsole(" presents...\n", { reset: true });
    std.writeConsole(" ".repeat((this.width - "Blackjack".length) / 2));
    std.writeConsole("Blackjack\n\n");

    await this.askForNumberOfPlayers();

    while (!this.isQuitting) {
      await this.askForBets();
      await this.dealInitialCards();
    }

    std.writeConsole("Now leaving ", { reset: true });
    std.writeConsole("Penger Casino", { fgColor: classicColors["yellow"] });
    std.writeConsole("...\n", { reset: true });
  }
}
