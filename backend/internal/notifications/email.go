package notifications

import (
	"net/smtp"
)

type EmailProvider struct {
	Host string
	Port string
	User string
	Pass string
	From string
}

func (e *EmailProvider) Name() string {
	return "email"
}

func (e *EmailProvider) Send(n *Notification) error {
	if n.UserEmail == "" {
		return nil
	}
	if e.Host == "" {
		return nil
	}
	return e.sendViaSMTP(n)
}

func (e *EmailProvider) sendViaSMTP(n *Notification) error {
	addr := e.Host + ":" + e.Port
	auth := smtp.PlainAuth("", e.User, e.Pass, e.Host)
	from := e.From
	if from == "" {
		from = e.User
	}
	subject := n.Subject
	if subject == "" {
		subject = "Timebook Notification"
	}
	body := n.Body
	if body == "" {
		body = n.PlainBody
	}
	msg := []byte("To: " + n.UserEmail + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" + body)
	return smtp.SendMail(addr, auth, from, []string{n.UserEmail}, msg)
}
