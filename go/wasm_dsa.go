package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"syscall/js"
	"time"

	"github.com/miekg/dns"
)

func main() {
	exports := map[string]func(js.Value, []js.Value) interface{}{
		"GenerateNTPPayload": GenerateNTPPayload,
		"ParseNTPPayload":    ParseNTPPayload,
		"GenerateDNSPayload": GenerateDNSPayload,
		"ParseDNSPayload":    ParseDNSPayload,
		"GenerateSCBPayload": GenerateSCBPayload,
		"ParseSCBPayload":    ParseSCBPayload,
	}

	for jsFuncName, goFunc := range exports {
		js.Global().Get("Go").Get("prototype").Set(jsFuncName, js.FuncOf(goFunc))
	}

	fmt.Println("Ready")
	select {}
}

func myFunc(this js.Value, args []js.Value) interface{} {
	resp := bytes.Repeat([]byte{'A', 'A', 'A'}, 10)
	output := js.Global().Get("Uint8ClampedArray").New(len(resp))
	n := js.CopyBytesToJS(output, resp)
	fmt.Println("myFunc output length", n)
	return output
}

func GenerateNTPPayload(this js.Value, args []js.Value) interface{} {
	const ntpPayloadLen = 48
	payload := make([]byte, ntpPayloadLen)
	payload[0] = 27
	output := js.Global().Get("Uint8ClampedArray").New(len(payload))
	_ = js.CopyBytesToJS(output, payload)
	return output
}

func ParseNTPPayload(this js.Value, args []js.Value) interface{} {
	var payload []byte
	if len(args) > 0 {
		payload = make([]byte, args[0].Length())
		if args[0].Type() == js.Global().Get("Uint8Array").New(1).Type() {
			_ = js.CopyBytesToGo(payload, args[0])
		}
	} else {
		fmt.Println("ParseNTPPayload argument mismatch", args)
		return nil
	}
	secondsSinceNTPEpoch := binary.BigEndian.Uint32(payload[40:45])
	ntpEpoch := time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)
	duration := time.Duration(int64(secondsSinceNTPEpoch) * time.Second.Nanoseconds())
	date := ntpEpoch.Add(duration).Local()
	return date.Format("Mon Jan 02 2006 15:04:05 GMT-0700")
}

func GenerateDNSPayload(this js.Value, args []js.Value) interface{} {
	var query string
	if len(args) > 0 && args[0].Type() == js.TypeString {
		query = args[0].String()
	} else {
		fmt.Println("GenerateDNSPayload argument mismatch", args)
		return nil
	}
	msg := new(dns.Msg)
	msg.SetQuestion(query+".", dns.TypeA)
	payload, err := msg.Pack()
	if err != nil {
		fmt.Print("GenerateDNSPayload", err)
		return nil
	}
	output := js.Global().Get("Uint8ClampedArray").New(len(payload))
	_ = js.CopyBytesToJS(output, payload)
	//fmt.Println("GenerateDNSPayload output length", n)
	return output
}

func ParseDNSPayload(this js.Value, args []js.Value) interface{} {
	var payload []byte
	//fmt.Println("ParseDNSPayload", args)
	if len(args) > 0 {
		payload = make([]byte, args[0].Length())
		if args[0].Type() == js.Global().Get("Uint8Array").New(1).Type() {
			_ = js.CopyBytesToGo(payload, args[0])
		}
	} else {
		fmt.Println("ParseDNSPayload argument mismatch", args)
		return nil
	}
	msg := new(dns.Msg)
	err := msg.Unpack(payload)
	if err != nil {
		fmt.Println("ParseDNSPayload", err)
		return nil
	}
	var output string
	if len(msg.Answer) > 0 {
		answer := msg.Answer[0]
		switch answer.(type) {
		case *dns.A:
			res := *(answer.(*dns.A))
			output = res.A.String()
		case *dns.AAAA:
			res := *(answer.(*dns.AAAA))
			output = res.AAAA.String()
		default:
			fmt.Println("ParseDNSPayload returned nil")
			return nil
		}
	}
	return output
}

func GenerateSCBPayload(this js.Value, args []js.Value) interface{} {
	var query string
	if len(args) > 0 && args[0].Type() == js.TypeString {
		query = args[0].String()
	} else {
		fmt.Println("GenerateSCBPayload argument mismatch", args)
		return nil
	}
	msg := new(dns.Msg)
	msg.SetQuestion(query+".", dns.TypeNAPTR)
	payload, err := msg.Pack()
	if err != nil {
		fmt.Print("GenerateSCBPayload", err)
		return nil
	}
	output := js.Global().Get("Uint8ClampedArray").New(len(payload))
	_ = js.CopyBytesToJS(output, payload)
	//fmt.Println("GenerateSCBPayload output length", n)
	return output
}

func ParseSCBPayload(this js.Value, args []js.Value) interface{} {
	var payload []byte
	if len(args) > 0 {
		payload = make([]byte, args[0].Length())
		if args[0].Type() == js.Global().Get("Uint8Array").New(1).Type() {
			_ = js.CopyBytesToGo(payload, args[0])
		}
	} else {
		fmt.Println("ParseSCBPayload argument mismatch", args)
		return nil
	}
	msg := new(dns.Msg)
	err := msg.Unpack(payload)
	if err != nil {
		fmt.Println("ParseSCBPayload", err)
		return nil
	}
	var output string
	if len(msg.Answer) > 0 {
		for _, answer := range msg.Answer {
			switch answer.(type) {
			case *dns.NAPTR:
				res := *(answer.(*dns.NAPTR))
				if res.Service != "x-sciondiscovery:tcp" {
					continue
				}
				if res.Flags == "A" {
					//fmt.Println("ParseSCBPayload", res.String())
					output = res.Replacement
				}
			default:
				fmt.Println("ParseSCBPayload returned nil")
				return nil
			}
		}
	}
	return output
}
