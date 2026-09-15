class Solution:
    BELOW_20 = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
                "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def numberToWords(self, num: int) -> str:
        if num == 0:
            return "Zero"
        def spell(n):
            if n == 0:
                return []
            if n < 20:
                return [self.BELOW_20[n]]
            if n < 100:
                return [self.TENS[n // 10]] + spell(n % 10)
            return [self.BELOW_20[n // 100], "Hundred"] + spell(n % 100)
        words = []
        for value, name in ((10**9, "Billion"), (10**6, "Million"), (1000, "Thousand"), (1, "")):
            if num >= value:
                words += spell(num // value) + ([name] if name else [])
                num %= value
        return " ".join(words)
