export type KeyboardLayouts = Record<string, any>;

// Languages exposed in the UI language picker
export const supportedLanguages: Array<{
  code: string;
  label: string;
  className: string;
}> = [
  { code: 'en', label: 'English', className: 'lang-en' },
  { code: 'es', label: 'Español', className: 'lang-es' },
  { code: 'fr', label: 'Français', className: 'lang-fr' },
  { code: 'de', label: 'Deutsch', className: 'lang-de' },
  { code: 'ru', label: 'Русский', className: 'lang-ru' },
  { code: 'ar', label: 'العربية', className: 'lang-ar' },
  { code: 'zh', label: '中文', className: 'lang-zh' },
  { code: 'ja', label: '日本語', className: 'lang-ja' },
  { code: 'ko', label: '한국어', className: 'lang-ko' },
];

export const layouts: KeyboardLayouts = {
  en: {
    default: [
      "1 2 3 4 5 6 7 8 9 0 {bksp}",
      "{tab} q w e r t y u i o p",
      "a s d f g h j k l",
      "{shift} z x c v b n m , .",
      "@ {space} {enter}"
    ],
    shift: [
      "! @ # $ % ^ & * ( ) _ + {bksp}",
      "Q W E R T Y U I O P",
      "A S D F G H J K L",
      "{shift} Z X C V B N M < > ?",
      "@ {space} {enter}"
    ]
  },

  es: {  // Latin American variant (most common for "es")
    default: [
      "1 2 3 4 5 6 7 8 9 0 {bksp}",
      "{tab} q w e r t y u i o p",
      "a s d f g h j k l ñ",
      "{shift} z x c v b n m , . -",
      "@ {space} {enter}"
    ],
    shift: [
      "! \" # $ % & / ( ) = ? ¿ ¡ {bksp}",
      "Q W E R T Y U I O P",
      "A S D F G H J K L Ñ",
      "{shift} Z X C V B N M ; : _",
      "@ {space} {enter}"
    ]
  },

  fr: {  // Standard AZERTY (France) - most common
    default: [
      "& é \" ' ( § è ! ç à ) - {bksp}",
      "a z e r t y u i o p ^ $",
      "q s d f g h j k l m ù *",
      "{shift} < w x c v b n , ; : ! {bksp}",
      "@ {space} {enter}"
    ],
    shift: [
      "1 2 3 4 5 6 7 8 9 0 ° _ {bksp}",
      "A Z E R T Y U I O P ¨ £",
      "Q S D F G H J K L M % µ",
      "{shift} > W X C V B N ? . / § {bksp}",
      "@ {space} {enter}"
    ]
  },

  de: {  // Standard QWERTZ (Germany/Austria)
    default: [
      "1 2 3 4 5 6 7 8 9 0 ß {bksp}",
      "{tab} q w e r t z u i o p ü +",
      "a s d f g h j k l ö ä #",
      "{shift} y x c v b n m , . -",
      "@ {space} {enter}"
    ],
    shift: [
      "! \" § $ % & / ( ) = ? € ` {bksp}",
      "Q W E R T Z U I O P Ü *",
      "A S D F G H J K L Ö Ä '",
      "{shift} Y X C V B N M ; : _",
      "@ {space} {enter}"
    ]
  },

  ru: {
    default: [
      "1 2 3 4 5 6 7 8 9 0 {bksp}",
      "й ц у к е н г ш щ з х ъ",
      "ф ы в а п р о л д ж э",
      "{shift} я ч с м и т ь б ю .",
      "@ {space} {enter}"
    ],
    shift: [
      "! \" № ; % : ? * ( ) _ + {bksp}",
      "Й Ц У К Е Н Г Ш Щ З Х Ъ",
      "Ф Ы В А П Р О Л Д Ж Э",
      "{shift} Я Ч С М И Т Ь Б Ю ,",
      "@ {space} {enter}"
    ]
  },

  ar: {  // Standard Arabic (101) - right-to-left visual order
    default: [
      "1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "ض ص ث ق ف غ ع ه خ ح ج د",
      "ش س ي ب ل ا ت ن م ك ط",
      "{shift} ئ ء ؤ ر لا ى ة و ز ظ {bksp}",
      "@ {space} {enter}"
    ],
    shift: [
      "! @ # $ % ^ & * ( ) _ + {bksp}",
      "َ ً ُ ٌ ِ ٍ ْ ـ [ ] { } \\ |",
      "ّ ّ ّ ّ ّ ّ ّ ّ : \" '",
      "{shift} ؟ ، ؛ / . , {bksp}",
      "@ {space} {enter}"
    ]
  },

  zh: {  // QWERTY + Pinyin IME (very common)
    default: [
      "1 2 3 4 5 6 7 8 9 0 {bksp}",
      "{tab} q w e r t y u i o p",
      "a s d f g h j k l",
      "{shift} z x c v b n m , .",
      "@ {space} {enter}"
    ],
    shift: [
      "! @ # $ % ^ & * ( ) _ + {bksp}",
      "Q W E R T Y U I O P",
      "A S D F G H J K L",
      "{shift} Z X C V B N M < >",
      "@ {space} {enter}"
    ]
  },

  ja: {  // Romaji + IME (very common)
    default: [
      "1 2 3 4 5 6 7 8 9 0 {bksp}",
      "{tab} q w e r t y u i o p",
      "a s d f g h j k l",
      "{shift} z x c v b n m , .",
      "@ {space} {enter}"
    ],
    shift: [
      "! \" # $ % & ' ( ) = ~ {bksp}",
      "Q W E R T Y U I O P",
      "A S D F G H J K L",
      "{shift} Z X C V B N M < > ?",
      "@ {space} {enter}"
    ]
  },

  ko: {  // Standard Dubeolsik (most common in South Korea)
    default: [
      "1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ",
      "ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ",
      "{shift} ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ , . /",
      "@ {space} {enter}"
    ],
    shift: [
      "! @ # $ % ^ & * ( ) _ + {bksp}",
      "ㅃ ㅉ ㄸ ㄲ ㅆ ㅛ ㅕ ㅑ ㅒ ㅖ",
      "ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ",
      "{shift} ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ < > ?",
      "@ {space} {enter}"
    ]
  }
};