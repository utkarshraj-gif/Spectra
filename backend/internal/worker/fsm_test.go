package worker

import (
	"testing"
)

func TestFSM_ValidLifecycleTransitions(t *testing.T) {
	fsm := NewFSM(StateScheduled)

	steps := []State{
		StateInitializing,
		StateNavigating,
		StatePreJoin,
		StateWaitingForAdmission,
		StateInMeeting,
		StateLeaving,
		StateCallEnded,
	}

	for _, step := range steps {
		err := fsm.Transition(step)
		if err != nil {
			t.Fatalf("Expected valid transition to %s, got error: %v", step, err)
		}
		if fsm.Current() != step {
			t.Fatalf("Expected state to be %s, got %s", step, fsm.Current())
		}
	}

	if !fsm.IsTerminal() {
		t.Fatalf("Expected CALL_ENDED to be a terminal state")
	}
}

func TestFSM_InvalidDirectTransition(t *testing.T) {
	fsm := NewFSM(StateScheduled)

	// Direct transition to IN_MEETING without pre-join is illegal
	err := fsm.Transition(StateInMeeting)
	if err == nil {
		t.Fatalf("Expected invalid transition error from SCHEDULED to IN_MEETING, got nil")
	}
}

func TestFSM_TerminalStateCannotTransition(t *testing.T) {
	fsm := NewFSM(StateCallEnded)

	err := fsm.Transition(StateInMeeting)
	if err == nil {
		t.Fatalf("Expected error transitioning out of terminal state, got nil")
	}
}

func TestFSM_TransitionToFailed(t *testing.T) {
	fsm := NewFSM(StateWaitingForAdmission)

	err := fsm.Transition(StateFailed)
	if err != nil {
		t.Fatalf("Expected valid transition to FAILED, got error: %v", err)
	}

	if !fsm.IsTerminal() {
		t.Fatalf("Expected FAILED to be a terminal state")
	}
}

