import _ from "lodash";
import { classicColors } from "../Color/ansi";
import { Color } from "../Color/Color";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

const INITIAL_CASH = 100;
const NAME_FIELD_WIDTH = 10;

const LESS = -1;
const EQUAL = 0;
const GREATER = 1;

const suits = ["hearts", "diamonds", "spades", "clubs"] as const;
const values = [
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
  public isFinished: boolean;

  constructor() {
    this.cards = [];
    this.bet = 0;
    this.isFinished = false;
  }

  public pushCard(card: Card) {
    this.cards.push(card);
  }

  public getIsBlackjack() {
    const cards = this.cards;
    const { sum } = this.getSum(true);
    return sum === 21 && cards.length === 2;
  }

  public getSum(sumAll: boolean = false) {
    const cards = this.cards;
    let acesAvailableToSubtract = 0;
    for (let i = 0; i < cards.length; i += 1) {
      if (cards[i].value === "A" && (sumAll || cards[i].faceUp)) {
        acesAvailableToSubtract += 1;
      }
    }
    let isHard = acesAvailableToSubtract === 0;

    let totalScore = 0;
    for (let i = 0; i < cards.length; i += 1) {
      if (sumAll || cards[i].faceUp) {
        totalScore += getScoreForCard(cards[i]);
      }
    }

    while (totalScore > 21 && acesAvailableToSubtract > 0) {
      totalScore -= 10;
      acesAvailableToSubtract -= 1;
      isHard = true;
    }

    return { isHard, sum: totalScore };
  }

  public reveal() {
    this.cards.forEach((c) => (c.faceUp = true));
  }

  public getIsRevealed() {
    return this.cards.reduce((acc, c) => acc && c.faceUp, true);
  }

  public getIsBusted() {
    return this.getSum(true).sum > 21;
  }

  /** b is assumed to be dealer hand. */
  public compareWith(b: Hand) {
    const a = this;

    const aSum = a.getSum(true).sum;
    const bSum = b.getSum(true).sum;
    const aIsBlackjack = a.getIsBlackjack();
    const bIsBlackjack = b.getIsBlackjack();
    const aIsBusted = a.getIsBusted();
    const bIsBusted = b.getIsBusted();

    if (aIsBusted && bIsBusted) {
      return LESS;
    }

    if (aIsBusted) {
      return LESS;
    }

    if (bIsBusted) {
      return GREATER;
    }

    if (aIsBlackjack && bIsBlackjack) {
      return EQUAL;
    }

    if (aIsBlackjack) {
      return GREATER;
    }

    if (bIsBlackjack) {
      return LESS;
    }

    if (aSum === bSum) {
      return EQUAL;
    }

    return aSum < bSum ? LESS : GREATER;
  }
}

class Player {
  public cash: number;
  public hands: Hand[];
  public isDealer: boolean;
  public name: string;

  constructor(name: string, isDealer: boolean) {
    this.cash = 0;
    this.hands = [];
    this.isDealer = isDealer;
    this.name = name;
  }

  public getCanSplit() {
    if (this.hands.length === 0 || this.hands.length > 1) {
      return false;
    }

    if (this.hands[0].cards.length > 2) {
      return false;
    }

    if (this.cash < this.hands[0].bet) {
      return false;
    }

    if (this.hands[0].cards[0].value !== this.hands[0].cards[1].value) {
      return false;
    }

    return true;
  }

  public getCanDouble() {
    if (this.hands.length === 0 || this.hands.length > 1) {
      return false;
    }

    if (this.hands[0].cards.length > 2) {
      return false;
    }

    if (this.cash < this.hands[0].bet) {
      return false;
    }

    return true;
  }
}

export class Blackjack implements Executable {
  private pc: PC;
  private width: number;

  private isQuitting: boolean = false;

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

  private resetRound() {
    for (const p of [...this.players, this.dealer]) {
      p.hands = [];
      p.hands.push(new Hand());
    }
  }

  private async askForBets() {
    const { std } = this.pc;

    for (let p = 0; p < this.players.length; p += 1) {
      const player = this.players[p];
      const hand = player.hands[0];

      hand.bet = 0;
      while (hand.bet === 0 || hand.bet > player.cash || hand.bet < 0) {
        std.writeConsole(
          `Player ${p + 1}, currently you have: $${player.cash}. Your bet? `,
        );
        const betString = await this.readLine();
        if (this.isQuitting) return;
        const betValue = Number(betString);
        if (betValue) {
          hand.bet = betValue;
        }
      }

      player.cash -= hand.bet;
    }

    std.writeConsole("\n");
  }

  private async dealInitialCards() {
    this.deck = _.shuffle(getFreshDeck());

    for (let j = 0; j < 2; j += 1) {
      for (const p of [...this.players, this.dealer]) {
        this.dealCard(p.hands[0], !p.isDealer || j === 0);
      }
    }
  }

  private printHands() {
    const { std } = this.pc;

    for (const p of [this.dealer, ...this.players]) {
      for (let i = 0; i < p.hands.length; i += 1) {
        if (i === 0) {
          std.writeConsole(`${_.padEnd(p.name, NAME_FIELD_WIDTH)}: `);
        } else {
          std.writeConsole(`${_.padEnd("", NAME_FIELD_WIDTH)}  `);
        }
        this.printHand(p.hands[i]);
        std.writeConsole("\n");
      }
    }
    std.writeConsole("\n");
  }

  private dealCard(hand: Hand, facingUp: boolean = true) {
    const card = this.deck.pop()!;
    card.faceUp = facingUp;
    hand.pushCard(card);
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

  private printHand(hand: Hand) {
    const { std } = this.pc;

    const cards = hand.cards;

    for (let c = 0; c < cards.length; c += 1) {
      this.printCard(cards[c]);
      std.writeConsole(" ");
    }
    std.writeConsole(
      `(${[
        String(hand.getSum().sum),
        hand.getIsBlackjack() && hand.getIsRevealed() && " - blackjack!",
        hand.getIsBusted() && " - busted",
      ]
        .filter(Boolean)
        .join("")})`,
    );
  }

  private splitHand(player: Player) {
    if (!player.getCanSplit()) {
      throw new Error("Cannot split at this point in time.");
    }

    const hand = player.hands[0];
    player.hands = [];

    const leftHand = new Hand();
    leftHand.bet = hand.bet;
    leftHand.pushCard(hand.cards[0]);
    this.dealCard(leftHand);
    const rightHand = new Hand();
    rightHand.bet = hand.bet;
    rightHand.pushCard(hand.cards[1]);
    this.dealCard(rightHand);

    player.cash -= hand.bet;
    player.hands = [leftHand, rightHand];
  }

  private doubleHand(player: Player) {
    if (!player.getCanDouble()) {
      throw new Error("Cannot double at this point in time.");
    }

    const hand = player.hands[0];
    this.dealCard(hand);
    player.cash -= hand.bet;
    hand.bet += hand.bet;

    hand.isFinished = true;
  }

  private hitHand(player: Player, hand: Hand) {
    this.dealCard(hand);
  }

  private stayHand(player: Player, hand: Hand) {
    hand.isFinished = true;
  }

  private async playHand(player: Player, handIndex: number) {
    const { std } = this.pc;

    while (!player.hands[handIndex].isFinished) {
      const hand = player.hands[handIndex];

      std.writeConsole(`${_.padEnd(this.dealer.name, NAME_FIELD_WIDTH)}: `);
      this.printHand(this.dealer.hands[0]);
      std.writeConsole(`\n${_.padEnd(player.name, NAME_FIELD_WIDTH)}: `);
      this.printHand(hand);
      std.writeConsole(`\n\n`);

      if (hand.getIsBlackjack()) {
        hand.isFinished = true;
        std.writeConsole("You got a blackjack!\n\n");
        continue;
      }

      if (hand.getIsBusted()) {
        hand.isFinished = true;
        std.writeConsole("Busted!\n\n");
        continue;
      }

      const canDouble = player.getCanDouble();
      const canSplit = player.getCanSplit();

      std.writeConsole(
        `${["[h]it", "[s]tay", canDouble && "[d]double", canSplit && "[/]split"]
          .filter(Boolean)
          .join(", ")}? `,
      );
      const action = (await this.readLine())?.trim().toLowerCase()[0];
      switch (action) {
        case "h":
          std.writeConsole("\n");
          this.hitHand(player, hand);
          break;
        case "s":
          std.writeConsole("\n");
          this.stayHand(player, hand);
          break;
        case "d":
          if (canDouble) {
            this.doubleHand(player);
            std.writeConsole("\n");
            std.writeConsole("You doubled.\n\n");
          }
          break;
        case "/":
          if (canSplit) {
            this.splitHand(player);
            std.writeConsole("\n");
            std.writeConsole("Your hand is split.\n\n");
          }
          break;
        case "q":
          this.isQuitting = true;
          return;
      }
    }
  }

  private async mainLoop() {
    const { std } = this.pc;

    while (!this.isQuitting) {
      this.resetRound();

      this.players = this.players.filter((p) => p.cash > 0);

      if (this.players.length === 0) {
        std.writeConsole(
          "Seems like you are a little short on cash... Better luck next time!\n",
        );
        this.isQuitting = true;
        continue;
      }

      await this.askForBets();
      if (this.isQuitting) return;

      this.dealInitialCards();
      const dealerHand = this.dealer.hands[0];

      if (dealerHand.getIsBlackjack()) {
        std.writeConsole("Dealer has a blackjack!\n\n");
        dealerHand.reveal();
        this.printHands();
      } else {
        std.writeConsole("Cards dealt, let's play!\n\n");

        for (
          let playerIndex = 0;
          playerIndex < this.players.length;
          playerIndex += 1
        ) {
          const player = this.players[playerIndex];
          for (
            let handIndex = 0;
            handIndex < player.hands.length;
            handIndex += 1
          ) {
            await this.playHand(player, handIndex);
            if (this.isQuitting) return;
          }
        }

        dealerHand.reveal();

        while (
          dealerHand.getSum().sum < 17 ||
          (dealerHand.getSum().sum === 17 &&
            dealerHand.getSum().isHard === false)
        ) {
          this.hitHand(this.dealer, dealerHand);
        }

        this.printHands();
      }

      // pay out
      for (
        let playerIndex = 0;
        playerIndex < this.players.length;
        playerIndex += 1
      ) {
        const player = this.players[playerIndex];
        for (
          let handIndex = 0;
          handIndex < player.hands.length;
          handIndex += 1
        ) {
          const hand = player.hands[handIndex];
          const compareResult = hand.compareWith(this.dealer.hands[0]);
          if (compareResult === GREATER) {
            if (hand.getIsBlackjack()) {
              player.cash += hand.bet + hand.bet * 1.5;
              std.writeConsole(`${player.name} won $${hand.bet * 1.5}.\n`);
            } else {
              player.cash += hand.bet + hand.bet;
              std.writeConsole(`${player.name} won $${hand.bet}.\n`);
            }
          } else if (compareResult === EQUAL) {
            player.cash += hand.bet;
            std.writeConsole(`${player.name} pushed.\n`);
          } else {
            std.writeConsole(`${player.name} lost $${hand.bet}.\n`);
          }
        }

        if (player.cash === 0) {
          std.writeConsole(`${player.name} is felted!\n`);
        }
      }

      std.writeConsole("\n");
    }
  }

  async run(args: string[]) {
    const { std } = this.pc;

    std.resetConsole();
    std.clearConsole();

    std.writeConsoleSequence(
      [
        { fgColor: classicColors["yellow"] },
        "Penger Casino",
        { reset: true },
        " presents...\n",
      ],
      { align: "center" },
    );
    std.writeConsoleSequence(["Blackjack\n\n"], { align: "center" });

    std.writeConsoleSequence([
      "By: ",
      { fgColor: classicColors["lightRed"] },
      "Strawberry",
      { reset: true },
      "\n\n",
    ]);

    std.writeConsole("To quit you can type [q] at any time.\n\n");
    await this.askForNumberOfPlayers();

    await this.mainLoop();

    std.writeConsole("\n");
    std.writeConsole("Now leaving ", { reset: true });
    std.writeConsole("Penger Casino", { fgColor: classicColors["yellow"] });
    std.writeConsole("...\n", { reset: true });
  }
}
