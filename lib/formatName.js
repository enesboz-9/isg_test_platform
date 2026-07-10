// Türkçe karakterlere duyarlı "Ad Soyad" biçimlendirme.
// "ENES BOZ", "enes boz", "eNeS bOz" -> "Enes Boz"
// toLocaleLowerCase/toLocaleUpperCase ile "tr-TR" locale'i kullanılır ki
// İ/i ve I/ı harfleri doğru şekilde dönüştürülsün.
export function toTitleCaseTR(value) {
  if (!value) return value;

  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            ? part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1)
            : part
        )
        .join("-")
    )
    .join(" ");
}
