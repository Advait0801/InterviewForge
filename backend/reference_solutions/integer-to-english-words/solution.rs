impl Solution {
    pub fn number_to_words(num: i32) -> String {
        if num == 0 {
            return "Zero".to_string();
        }
        const ONES: [&str; 20] = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const TENS: [&str; 10] = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        fn chunk(mut n: usize, words: &mut Vec<&'static str>) {
            if n >= 100 {
                words.push(ONES[n / 100]);
                words.push("Hundred");
                n %= 100;
            }
            if n >= 20 {
                words.push(TENS[n / 10]);
                n %= 10;
            }
            if n > 0 {
                words.push(ONES[n]);
            }
        }
        let mut words = vec![];
        for (value, name) in [(1_000_000_000, "Billion"), (1_000_000, "Million"), (1_000, "Thousand"), (1, "")] {
            let part = (num as usize / value) % 1000;
            if part > 0 {
                chunk(part, &mut words);
                if !name.is_empty() {
                    words.push(name);
                }
            }
        }
        words.join(" ")
    }
}
