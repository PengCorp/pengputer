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
  splitStringIntoCharacters(""),
  ["energyStar00", "energyStar01", "energyStar02", "energyStar03", "energyStar04", "energyStar05", "energyStar06", "energyStar07", "energyStar08", "energyStar09", "energyStar0A", "energyStar0B", "energyStar0C", "energyStar0D", "energyStar0E"],
  ["energyStar10", "energyStar11", "energyStar12", "energyStar13", "energyStar14", "energyStar15", "energyStar16", "energyStar17", "energyStar18", "energyStar19", "energyStar1A", "energyStar1B", "energyStar1C", "energyStar1D", "energyStar1E"],
  ["energyStar20", "energyStar21", "energyStar22", "energyStar23", "energyStar24", "energyStar25", "energyStar26", "energyStar27", "energyStar28", "energyStar29", "energyStar2A", "energyStar2B", "energyStar2C", "energyStar2D", "energyStar2E"],
  ["energyStar30", "energyStar31", "energyStar32", "energyStar33", "energyStar34", "energyStar35", "energyStar36", "energyStar37", "energyStar38", "energyStar39", "energyStar3A", "energyStar3B", "energyStar3C", "energyStar3D", "energyStar3E"],
  ["energyStar40", "energyStar41", "energyStar42", "energyStar43", "energyStar44", "energyStar45", "energyStar46", "energyStar47", "energyStar48", "energyStar49", "energyStar4A", "energyStar4B", "energyStar4C", "energyStar4D", "energyStar4E"],
];

/* cSpell:enable */

const charMap: Record<string, Coord> = {};

for (let y = 0; y < charMapArray.length; y += 1) {
  const row = charMapArray[y];
  for (let x = 0; x < row.length; x += 1) {
    charMap[row[x]] = { x, y };
  }
}

let font9x16: Font | null = null;

export const loadFont9x16 = async (gl: WebGL2RenderingContext) => {
  if (font9x16) {
    return font9x16;
  }

  font9x16 = await Font.load(gl, cp437_9x16Url, cp437_9x16AttrUrl, charMap, {
    w: 9,
    h: 16,
  });

  return font9x16;
};
