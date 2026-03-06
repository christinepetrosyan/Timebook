package notifications

// Notification represents a message to send to a user
type Notification struct {
	UserEmail    string
	UserName     string
	UserPhone    string
	Subject      string
	Body         string
	PlainBody    string
	TelegramChatID string
	WhatsAppPhone  string
	ViberUserID    string
}

// Provider sends notifications via a specific channel
type Provider interface {
	Send(n *Notification) error
	Name() string
}
