import { Font } from "./Font";

import { splitStringIntoCharacters } from "@Toolbox/String";

import cp437_9x16Url from "./cp437_9x16.png";
import cp437_9x16AttrUrl from "./cp437_9x16_attr.png";
import type { Coord } from "@src/types";

/* cSpell:disable */

// prettier-ignore
const charMapArray = [
  splitStringIntoCharacters("\x00!\"#$%&'()*+,-./0123456789:;<=>?🬀🬁🬂🬃🬄🬅🬆🬇🬈🬉🬊🬋🬌🬍🬎🬏"),
  splitStringIntoCharacters("@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_🬐🬑🬒🬓🬔🬕🬖🬗🬘🬙🬚🬛🬜🬝🬞🬟"),
  splitStringIntoCharacters("`abcdefghijklmnopqrstuvwxyz{|}~⌂🬠🬡🬢🬣🬤🬥🬦🬧🬨🬩🬪🬫🬬🬭🬮🬯"),
  splitStringIntoCharacters(" ¡¢£¤¥¦§¨©ª«¬-®¯°±²³´µ¶·¸¹º»¼½¾¿🬰🬱🬲🬳🬴🬵🬶🬷🬸🬹🬺🬻🬼🬽🬾🬿"),
  splitStringIntoCharacters("ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß🭀🭁🭂🭃🭄🭅🭆🭇🭈🭉🭊🭋🭌🭍🭎🭏"),
  splitStringIntoCharacters("àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ🭐🭑🭒🭓🭔🭕🭖🭗🭘🭙🭚🭛🭜🭝🭞🭟"),
  splitStringIntoCharacters("ĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğ🭠🭡🭢🭣🭤🭥🭦🭧🭨🭩🭪🭫🭬🭭🭮🭯"),
  splitStringIntoCharacters("ĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿ🭰🭱🭲🭳🭴🭵🭶🭷🭸🭹🭺🭻🭼🭽🭾🭿"),
  splitStringIntoCharacters("ŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞş🮀🮁🮂🮃🮄🮅🮆🮇🮈🮉🮊🮋🮌🮍🮎🮏"),
  splitStringIntoCharacters("ŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ🮐🮑🮒🮔 🮕🮖🮗🮘🮙🮚🮛🮜🮝🮞🮟"),
  splitStringIntoCharacters("ƒơƷǺǻǼǽǾǿȘșȚțɑɸˆˇˉ˘˙˚˛˜˝;΄΅Ά·ΈΉΊ🮠🮡🮢🮣🮤🮥🮦🮧🮨🮩🮪🮫🮬🮭🮮🮯"),
  splitStringIntoCharacters("ΌΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΪΫάέ🮰🮱🮲🮳🮴🮵🮶🮷🮸🮹🮺🮻🮼🮽🮾🮿"),
  splitStringIntoCharacters("ήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύ🯀🯁🯂🯃🯄🯅🯆🯇🯈🯉🯊🯋🯌🯍🯎🯏"),
  splitStringIntoCharacters("ώϐϴЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏАБВГДЕЖЗИЙКЛМ🯐🯑🯒🯓🯔🯕🯖🯗🯘🯙🯚🯛🯜🯝🯞🯟"),
  splitStringIntoCharacters("НОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклм🯠🯡🯢🯣🯤🯥🯦🯧🯨🯩🯪🯫🯬🯭🯮🯯"),
  splitStringIntoCharacters("нопрстуфхцчшщъыьэюяѐёђѓєѕіїјљњћќ🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹      "),
  [
    ...splitStringIntoCharacters("ѝўџҐґ                           "),
    "penger00",
    "penger01",
    "penger02",
    "pengDollar",
    "floppy0",
    "floppy1",
    "floppyDrive0",
    "floppyDrive1",
    "hardDrive0",
    "hardDrive1",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    ...splitStringIntoCharacters("      ᴛᴦᴨẀẁẂẃẄẅẟỲỳ‐‒–—―‗‘’‚‛“”„‟"),
    "penger10",
    "penger11",
    "penger12",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  splitStringIntoCharacters("†‡•…‧‰′″‵‹›‼‾‿⁀⁄⁔⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₁₂₃₄₅₆"),
  splitStringIntoCharacters("₇₈₉₊₋₣₤₧₪€℅ℓ№™Ω℮⅐⅑⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞←↑"),
  splitStringIntoCharacters("→↓↔↕↨∂∅∆∈∏∑−∕∙√∞∟∩∫≈≠≡≤≥⊙⌀⌂⌐⌠⌡─│"),
  splitStringIntoCharacters("┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦"),
  splitStringIntoCharacters("╧╨╩╪╫╬▀▁▄█▌▐░▒▓■□▪▫▬▲►▼◄◊○●◘◙◦☺☻"),
  splitStringIntoCharacters("☼♀♂♠♣♥♦♪♫✓ﬁﬂ�"),
];

/* cSpell:enable */

const charMap: Record<string, Coord> = {};

for (let y = 0; y < charMapArray.length; y += 1) {
  const row = charMapArray[y];
  for (let x = 0; x < row.length; x += 1) {
    charMap[row[x]] = { x, y };
  }
}

export const loadFont9x16 = async (gl: WebGL2RenderingContext) => {
  const font = await Font.load(gl, cp437_9x16Url, cp437_9x16AttrUrl, charMap, {
    w: 9,
    h: 16,
  });

  return font;
};
