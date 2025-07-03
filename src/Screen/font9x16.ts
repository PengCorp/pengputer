import { splitStringIntoCharacters } from "../Toolbox/String";
import { Font } from "./Font";
import cp437 from "./cp437_9x16.png";
import cp437plus from "./cp437plus_9x16.png";
import cp437legacy from "./cp437legacy_9x16_2x.png";
import cp437patterns from "./cp437patterns_9x16.png";

// 32 characters wide, 8 characters high
const cp437CharacterValueMap = [
  " ☺︎☻♥︎♦︎♣︎♠︎•◘○◙♂︎♀︎♪♫☼►◄↕︎‼︎¶§▬↨↑↓→←∟↔︎▲▼",
  " !\"#$%&'()*+,-./0123456789:;<=>?",
  "@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_",
  "`abcdefghijklmnopqrstuvwxyz{|}~⌂",
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ",
  "áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐",
  "└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀",
  "αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ",
].map((l) => splitStringIntoCharacters(l));

// Sourced from: https://int10h.org/oldschool-pc-fonts/fontlist/font?ibm_vga_9x16
// 74 characters wide, 11 characters high
export const cp437plusCharacterValueMap = [
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghi",
  "jklmnopqrstuvwxyz{|}~⌂ ¡¢£¤¥¦§¨©ª«¬-®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓ",
  "ÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝ",
  "ĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧ",
  "ŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſƒơƷǺǻǼǽǾǿȘșȚțɑɸˆˇˉ˘˙˚˛˜˝;΄΅Ά·ΈΉΊΌΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞ",
  "ΟΠΡΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώϐϴЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏАБВГДЕЖЗИ",
  "ЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяѐёђѓєѕіїјљњћќѝўџҐґ־",
  "                                ᴛᴦᴨẀẁẂẃẄẅẟỲỳ‐‒–—―‗‘’‚‛“”„‟†‡•…‧‰′″‵‹›‼‾‿⁀⁄",
  "⁔⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₁₂₃₄₅₆₇₈₉₊₋₣₤₧₪€℅ℓ№™Ω℮⅐⅑⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞←↑→↓↔↕↨∂∅∆∈∏∑−∕∙√∞∟∩∫≈≠≡≤≥⊙⌀",
  "⌂⌐⌠⌡─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬▀▁▄█▌▐░▒▓■□▪▫▬▲►▼◄◊○●◘◙◦☺☻☼♀♂♠",
  "♣♥♦♪♫✓ﬁﬂ�",
].map((l) => splitStringIntoCharacters(l));

export const cp437legacyCharacterValueMap = [
  "🬀🬁🬂🬃🬄🬅🬆🬇🬈🬉🬊🬋🬌🬍🬎🬏",
  "🬐🬑🬒🬓🬔🬕🬖🬗🬘🬙🬚🬛🬜🬝🬞🬟",
  "🬠🬡🬢🬣🬤🬥🬦🬧🬨🬩🬪🬫🬬🬭🬮🬯",
  "🬰🬱🬲🬳🬴🬵🬶🬷🬸🬹🬺🬻🬼🬽🬾🬿",
  "🭀🭁🭂🭃🭄🭅🭆🭇🭈🭉🭊🭋🭌🭍🭎🭏",
  "🭐🭑🭒🭓🭔🭕🭖🭗🭘🭙🭚🭛🭜🭝🭞🭟",
  "🭠🭡🭢🭣🭤🭥🭦🭧🭨🭩🭪🭫🭬🭭🭮🭯",
  "🭰🭱🭲🭳🭴🭵🭶🭷🭸🭹🭺🭻🭼🭽🭾🭿",
  "🮀🮁🮂🮃🮄🮅🮆🮇🮈🮉🮊🮋🮌🮍🮎🮏",
  "🮐🮑🮒🮔 🮕🮖🮗🮘🮙🮚🮛🮜🮝🮞🮟",
  "🮠🮡🮢🮣🮤🮥🮦🮧🮨🮩🮪🮫🮬🮭🮮🮯",
  "🮰🮱🮲🮳🮴🮵🮶🮷🮸🮹🮺🮻🮼🮽🮾🮿",
  "🯀🯁🯂🯃🯄🯅🯆🯇🯈🯉🯊🯋🯌🯍🯎🯏",
  "🯐🯑🯒🯓🯔🯕🯖🯗🯘🯙🯚🯛🯜🯝🯞🯟",
  "🯠🯡🯢🯣🯤🯥🯦🯧🯨🯩🯪🯫🯬🯭🯮🯯",
  "🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹",
].map((l) => splitStringIntoCharacters(l));

export const cp437patternsCharacterValueMap = ["░", "▒", "▓"].map((l) =>
  splitStringIntoCharacters(l)
);

export const font9x16 = new Font(9, 16, "░▒▓");

export const loadFont9x16 = async () => {
  await font9x16.loadAtlas(
    "cp437patterns",
    cp437patterns,
    cp437patternsCharacterValueMap,
    1,
    4
  );
  await font9x16.loadAtlas("cp437", cp437, cp437CharacterValueMap);
  await font9x16.loadAtlas("cp437plus", cp437plus, cp437plusCharacterValueMap);
  await font9x16.loadAtlas(
    "cp437legacy",
    cp437legacy,
    cp437legacyCharacterValueMap,
    2
  );
};
