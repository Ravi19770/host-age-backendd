const BAD_KEYWORD = {
  adult: [
    "adult",
    "porn",
    "xxx",
    "pornography",
    "erotic",
    "explicit",
    "nsfw",
    "nude",
    "nudity",
    "adult video",
    "adult content",
    "hardcore",
    "onlyfans",
    "fetish",
    "milf",
    "sexual",
  ],

  hateSpeech: [
    "hate speech",
    "extremist",
    "discrimination",
    "racial slur",
    "racism",
    "supremacy",
    "hate group",
    "bigotry",
  ],

  gambling: [
    "casino",
    "gambling",
    "betting",
    "sports betting",
    "online betting",
    "poker",
    "roulette",
    "jackpot",
    "wager",
    "lottery",
  ],

  drugs: [
    "drug trafficking",
    "controlled substance",
    "narcotics",
    "illegal drugs",
    "substance abuse",
    "drug sale",
    "drug market",
  ],
};

const MAX_TEXT_LENGTH = 200000;

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function checkCategory(text, keywords) {
  if (
    !text ||
    typeof text !== "string"
  ) {
    return false;
  }

  const normalizedText = text
    .slice(0, MAX_TEXT_LENGTH)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return keywords.some((keyword) => {
    const escaped = escapeRegex(
      keyword.toLowerCase()
    );

    const regex = new RegExp(
      `(^|\\s|[^a-z0-9])${escaped}(?=\\s|[^a-z0-9]|$)`,
      "i"
    );

    return regex.test(normalizedText);
  });
}

function moderateContent(text) {
  return {
    adult: checkCategory(
      text,
      BAD_KEYWORD.adult
    ),

    hateSpeech: checkCategory(
      text,
      BAD_KEYWORD.hateSpeech
    ),

    gambling: checkCategory(
      text,
      BAD_KEYWORD.gambling
    ),

    drugs: checkCategory(
      text,
      BAD_KEYWORD.drugs
    ),
  };
}

module.exports = {
  moderateContent,
};