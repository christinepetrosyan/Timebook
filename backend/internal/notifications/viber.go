package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type ViberProvider struct {
	AuthToken string
}

func (v *ViberProvider) Name() string {
	return "viber"
}

func (v *ViberProvider) Send(n *Notification) error {
	if v.AuthToken == "" || n.ViberUserID == "" {
		return nil
	}
	url := "https://chatapi.viber.com/pa/send_message"
	body := n.PlainBody
	if body == "" {
		body = n.Body
	}
	payload := map[string]interface{}{
		"receiver": n.ViberUserID,
		"type":    "text",
		"text":    body,
		"sender": map[string]string{
			"name": "Timebook",
		},
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("X-Viber-Auth-Token", v.AuthToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("viber API error: %d", resp.StatusCode)
	}
	return nil
}
