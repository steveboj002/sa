import { startCountdown, stopCountdown, countdownIntervalId, timeLeft, lastAlertSent, mutedUntil, sendEmailAlert as originalSendEmailAlert, triggerAlert } from '../public/utils.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock the sendEmailAlert function within the utils module for triggerAlert tests
jest.mock('../public/utils.js', () => {
  // Using jest.requireActual to get the original implementation of utils.js
  // but specifically mocking sendEmailAlert.
  const actualUtils = jest.requireActual('../public/utils.js');
  return {
    ...actualUtils,
    // We'll use this mocked sendEmailAlert when triggerAlert is called.
    // It will be a Jest mock function.
    sendEmailAlert: jest.fn(), 
  };
});

// Import the mocked sendEmailAlert directly for assertions in triggerAlert tests.
// This will be the jest.fn() from the jest.mock above.
import { sendEmailAlert } from '../public/utils.js';

describe('Countdown Timer', () => {
  let countdownTimer;

  beforeEach(() => {
    // Create a mock DOM element for the countdown timer
    document.body.innerHTML =
      '<div id="countdown-timer" class="hidden"></div>';
    countdownTimer = document.getElementById('countdown-timer');
    
    jest.useFakeTimers();

    // Explicitly call stopCountdown to reset module-level state for each test
    stopCountdown(); 

    // Ensure timer starts hidden for all countdown tests
    countdownTimer.classList.add('hidden'); 
    countdownTimer.textContent = ''; // Clear text content

    localStorageMock.clear(); // Clear localStorage mock for each test
    localStorageMock.setItem('token', 'fake-token'); // Set a default token for tests that need it
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = ''; // Clean up DOM after each test
    // Clear all mocks for jest.fn() that are defined globally or within test suites.
    // For module-level mocks, their state is usually reset by jest.mock/actual, but explicit clear is safer.
    jest.clearAllMocks(); 
  });

  test('startCountdown should set up an interval and decrement timeLeft', () => {
    startCountdown(10); // Start with 10 seconds
    expect(timeLeft).toBe(10);
    expect(countdownIntervalId).not.toBeNull();
    expect(countdownTimer.classList.contains('hidden')).toBe(false); // Should be visible
    expect(countdownTimer.textContent).toBe('Next analysis in 10 seconds');

    jest.advanceTimersByTime(1000);
    expect(timeLeft).toBe(9);
    expect(countdownTimer.textContent).toBe('Next analysis in 9 seconds');

    jest.advanceTimersByTime(5000);
    expect(timeLeft).toBe(4);
    expect(countdownTimer.textContent).toBe('Next analysis in 4 seconds');
  });

  test('stopCountdown should clear the interval and reset timeLeft to 0', () => {
    startCountdown(5);
    expect(timeLeft).toBe(5);
    expect(countdownTimer.classList.contains('hidden')).toBe(false);

    stopCountdown();
    expect(countdownIntervalId).toBeNull();
    expect(timeLeft).toBe(0);
    expect(countdownTimer.classList.contains('hidden')).toBe(true); // Should be hidden
  });

  test('countdown should stop at 0 and clear interval', () => {
    startCountdown(2);
    expect(timeLeft).toBe(2);
    expect(countdownTimer.classList.contains('hidden')).toBe(false);
    expect(countdownTimer.textContent).toBe('Next analysis in 2 seconds');

    jest.advanceTimersByTime(1000);
    expect(timeLeft).toBe(1);
    expect(countdownTimer.textContent).toBe('Next analysis in 1 seconds');

    jest.advanceTimersByTime(1000);
    jest.runOnlyPendingTimers(); // Ensure final interval execution
    expect(timeLeft).toBe(0);
    expect(countdownIntervalId).toBeNull(); // Should be cleared when it hits 0
    expect(countdownTimer.textContent).toBe('Next analysis in 0 seconds');
    expect(countdownTimer.classList.contains('hidden')).toBe(false); // It hides only on stopCountdown

    jest.advanceTimersByTime(1000); // Advance more to ensure it doesn't go negative or restart
    expect(timeLeft).toBe(0);
    expect(countdownTimer.textContent).toBe('Next analysis in 0 seconds');
  });
});

describe('Email Alerts', () => {
  let alertEmailInput, errorDiv, alertCooldownInput, muteMaAlertsCheckbox;

  beforeEach(() => {
    // Mock DOM elements for email alerts
    document.body.innerHTML = `
      <input id="alertEmail" type="email" value="test@example.com">
      <div id="error" class="hidden"></div> <!-- Ensure error div starts hidden -->
      <input id="alertCooldown" type="number" value="5">
      <input id="muteMaAlerts" type="checkbox">
    `;
    alertEmailInput = document.getElementById('alertEmail');
    errorDiv = document.getElementById('error');
    alertCooldownInput = document.getElementById('alertCooldown');
    muteMaAlertsCheckbox = document.getElementById('muteMaAlerts');

    localStorageMock.clear();
    localStorageMock.setItem('token', 'fake-token');

    // Reset alert tracking objects
    for (const key in lastAlertSent) { delete lastAlertSent[key]; }
    for (const key in mutedUntil) { delete mutedUntil[key]; }

    jest.useFakeTimers();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Email sent' }),
      })
    );
    // Clear the mock for the imported sendEmailAlert before each test
    sendEmailAlert.mockClear(); 
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
    global.fetch.mockRestore(); // Restore original fetch
    jest.clearAllMocks(); // Clear all mocks, including sendEmailAlert
  });

  describe('originalSendEmailAlert', () => {
    test('should not send email if no recipient email is provided', async () => {
      alertEmailInput.value = '';
      await originalSendEmailAlert('ASML', 'Test Subject', 'Test Body');

      expect(global.fetch).not.toHaveBeenCalled();
      // As per utils.js implementation, no UI error is displayed for missing recipient email
      expect(errorDiv.classList.contains('hidden')).toBe(true);
      expect(errorDiv.textContent).toBe('');
    });

    test('should not send email if recipient email format is invalid', async () => {
      alertEmailInput.value = 'invalid-email';
      await originalSendEmailAlert('ASML', 'Test Subject', 'Test Body');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(errorDiv.classList.contains('hidden')).toBe(false);
      expect(errorDiv.textContent).toBe('Invalid email format for alert recipient.');
    });

    test('should not send email if no authentication token is found', async () => {
      localStorageMock.removeItem('token');
      await originalSendEmailAlert('ASML', 'Test Subject', 'Test Body');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(errorDiv.classList.contains('hidden')).toBe(false);
      expect(errorDiv.textContent).toBe('Authentication required to send email alerts.');
    });

    test('should send email successfully with correct parameters', async () => {
      const symbol = 'ASML';
      const subject = 'Test Subject';
      const body = 'Test Body';
      const recipientEmail = 'test@example.com';

      await originalSendEmailAlert(symbol, subject, body);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[0]).toBe('/send-alert-email');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
      expect(fetchCall[1].headers['Authorization']).toBe(`Bearer fake-token`);

      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.recipientEmail).toBe(recipientEmail);
      expect(requestBody.subject).toMatch(/^[0-9/ :APM]{2,}.* - Test Subject$/); // Date/Time prefix
      expect(requestBody.body).toBe(`${body}<br/><br/>This alert was triggered for ASML.`);
      expect(errorDiv.classList.contains('hidden')).toBe(true); // Error should be hidden on success
    });

    test('should handle email sending failure', async () => {
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Send failure' }),
        })
      );

      await originalSendEmailAlert('ASML', 'Test Subject', 'Test Body');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(errorDiv.classList.contains('hidden')).toBe(false);
      expect(errorDiv.textContent).toBe('Failed to send email alert for ASML: Send failure');
    });

    test('should handle network error during email sending', async () => {
      global.fetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network down'))
      );

      await originalSendEmailAlert('ASML', 'Test Subject', 'Test Body');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(errorDiv.classList.contains('hidden')).toBe(false);
      expect(errorDiv.textContent).toBe('Error sending email alert for ASML.');
    });
  });

  describe('triggerAlert', () => {
    // sendEmailAlert is mocked at the module level

    beforeEach(() => {
      // Clear the mock for sendEmailAlert before each triggerAlert test
      sendEmailAlert.mockClear(); 
      // Reset alert tracking objects again as they might be modified by previous tests in this describe block
      for (const key in lastAlertSent) { delete lastAlertSent[key]; }
      for (const key in mutedUntil) { delete mutedUntil[key]; }
    });

    test('should send an alert if not throttled and not muted', async () => {
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body');
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);
      expect(lastAlertSent['ASML_MA50']).toBeDefined();
      expect(mutedUntil['ASML_MA50']).toBeUndefined();
    });

    test('should not send an alert if throttled', async () => {
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body'); // First alert
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);

      // Advance time by less than cooldown (default 5 seconds)
      jest.advanceTimersByTime(2000);

      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body'); // Second alert
      expect(sendEmailAlert).toHaveBeenCalledTimes(1); // Still 1
    });

    test('should send an alert if throttled but cooldown passes', async () => {
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body'); // First alert
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);

      // Advance time by more than cooldown (default 5 seconds)
      jest.advanceTimersByTime(5001);

      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body'); // Second alert
      expect(sendEmailAlert).toHaveBeenCalledTimes(2); // Now 2
    });

    test('should not send an alert if muted', async () => {
      muteMaAlertsCheckbox.checked = true;
      await triggerAlert('ASML', 'MA50', true, 'MA50 Alert', 'MA50 body'); // Send with mute
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);
      expect(mutedUntil['ASML_MA50']).toBeDefined();

      await triggerAlert('ASML', 'MA50', true, 'MA50 Alert', 'MA50 body'); // Try again while muted
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);
    });

    test('should unmute manually and send alert if mute checkbox is turned off', async () => {
      muteMaAlertsCheckbox.checked = true;
      await triggerAlert('ASML', 'MA50', true, 'MA50 Alert', 'MA50 body'); // Mute and send
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);
      expect(mutedUntil['ASML_MA50']).toBeDefined();

      muteMaAlertsCheckbox.checked = false; // Manually unmute
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body'); // Try again unmuted
      expect(sendEmailAlert).toHaveBeenCalledTimes(2);
      expect(mutedUntil['ASML_MA50']).toBeUndefined();
      expect(lastAlertSent['ASML_MA50']).toBeDefined(); // Cooldown should be reset
    });

    test('should use configurable alert cooldown from UI', async () => {
      alertCooldownInput.value = '1'; // 1 second cooldown
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body'); // First alert
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(500); // Less than 1 second
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body');
      expect(sendEmailAlert).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(501); // More than 1 second
      await triggerAlert('ASML', 'MA50', false, 'MA50 Alert', 'MA50 body');
      expect(sendEmailAlert).toHaveBeenCalledTimes(2);
    });
  });
});
