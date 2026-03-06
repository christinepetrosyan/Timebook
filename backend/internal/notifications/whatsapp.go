package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type WhatsAppProvider struct {
	AccessToken   string
	PhoneNumberID string
}

func (w *WhatsAppProvider) Name() string {
	return "whatsapp"
}

func (w *WhatsAppProvider) Send(n *Notification) error {
	if w.AccessToken == "" || w.PhoneNumberID == "" || n.WhatsAppPhone == "" {
		return nil
	}
	// Format phone for WhatsApp (remove +, ensure country code)
	phone := n.WhatsAppPhone
	if len(phone) > 0 && phone[0] == '+' {
		phone = phone[1:]
	}
	url := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/messages", w.PhoneNumberID)
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                phone,
		"type":              "text",
		"text": map[string]string{
			"body": n.PlainBody,
		},
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+w.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("whatsapp API error: %d", resp.StatusCode)
	}
	return nil
}
