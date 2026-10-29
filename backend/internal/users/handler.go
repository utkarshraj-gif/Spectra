package users

import (
	"encoding/json"
	"net/http"
)

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type UserHandler struct{}

func NewHandler() *UserHandler {
	return &UserHandler{}
}

func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	user := User{
		ID:    "usr_1",
		Email: "user@spectrum.ai",
		Name:  "Lead Engineer",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
