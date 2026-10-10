FROM golang:1.23-bookworm
# Adds missing standard-library imports to a solution without reformatting it.
COPY ifimports.go /tmp/ifimports/main.go
RUN cd /tmp/ifimports && CGO_ENABLED=0 GOTOOLCHAIN=local go build -o /usr/local/bin/ifimports main.go && rm -rf /tmp/ifimports /root/.cache
RUN useradd --create-home runner
# No network in the sandbox: never try to fetch a toolchain or a module.
ENV GOTOOLCHAIN=local GOPROXY=off GOFLAGS=-buildvcs=false CGO_ENABLED=0 \
    GOCACHE=/home/runner/.gocache
WORKDIR /home/runner
USER runner
# Go ships no prebuilt standard library, so a cold cache recompiles fmt,
# encoding/json and friends on every run -- seconds of a 1-CPU, 15 s budget.
# Warm the cache here with the packages the harness and typical solutions use;
# each run's writes land in its own throwaway container layer.
RUN mkdir -p /tmp/warm && printf '%s\n' \
    'package main' \
    'import (' \
    '  "bufio"; "bytes"; "cmp"; "container/heap"; "container/list"; "encoding/json"; "errors"; "fmt"' \
    '  "maps"; "math"; "math/bits"; "math/rand"; "os"; "regexp"; "slices"; "sort"; "strconv"; "strings"' \
    '  "unicode"; "unicode/utf8"' \
    ')' \
    'var _ = heap.Init; var _ = list.New; var _ = bits.Len; var _ = slices.Sort[[]int]; var _ = maps.Keys[map[int]int]' \
    'var _ = sort.Ints; var _ = strconv.Itoa; var _ = strings.Split; var _ = unicode.IsDigit; var _ = math.MaxInt' \
    'var _ = bytes.Equal; var _ = cmp.Compare[int]; var _ = errors.New; var _ = rand.Intn; var _ = regexp.MustCompile; var _ = utf8.RuneLen' \
    'func main() { w := bufio.NewWriter(os.Stdout); b, _ := json.Marshal(1); fmt.Fprintln(w, string(b)); w.Flush() }' \
    > /tmp/warm/main.go \
 && go build -o /tmp/warm/main /tmp/warm/main.go && /tmp/warm/main && rm -rf /tmp/warm
CMD ["sh", "-c", "cp /home/runner/main.go /tmp/ && ifimports /home/runner/solution.go /tmp/solution.go && cd /tmp && go build -o /tmp/sol main.go solution.go && /tmp/sol"]
