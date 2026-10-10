var numberToWords = function (num) {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
    "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const chunk = (n) => {
    const words = [];
    if (n >= 100) { words.push(ones[Math.floor(n / 100)], "Hundred"); n %= 100; }
    if (n >= 20) { words.push(tens[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) words.push(ones[n]);
    return words;
  };
  const words = [];
  for (const [value, name] of [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"], [1, ""]]) {
    const part = Math.floor(num / value) % 1000;
    if (part) words.push(...chunk(part), ...(name ? [name] : []));
  }
  return words.join(" ");
};
