package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type TelegramProvider struct {
	BotToken string
}

func (t *TelegramProvider) Name() string {
	return "telegram"
}

func (t *TelegramProvider) Send(n *Notification) error {
	if t.BotToken == "" || n.TelegramChatID == "" {
		return nil
	}
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", t.BotToken)
	body := n.PlainBody
	if body == "" {
		body = n.Body
	}
	payload := map[string]interface{}{
		"chat_id": n.TelegramChatID,
		"text":    body,
	}
	b, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API error: %d", resp.StatusCode)
	}
	return nil
}
