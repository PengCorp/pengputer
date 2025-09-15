import { splitStringIntoCharacters } from "@Toolbox/String";

/* cSpell:disable */

// prettier-ignore
const charMapArray = [
  splitStringIntoCharacters(" !\"#$%&'()*+,-./0123456789:;<=>?🬀🬁🬂🬃🬄🬅🬆🬇🬈🬉🬊🬋🬌🬍🬎🬏"),
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

const charMap: Record<string, { x: number; y: number }> = {};

for (let y = 0; y < charMapArray.length; y += 1) {
  const row = charMapArray[y];
  for (let x = 0; x < row.length; x += 1) {
    charMap[row[x]] = { x, y };
  }
}

export { charMap };
