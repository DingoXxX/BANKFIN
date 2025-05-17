import { BankfinUI } from './webUi.js';
import '@testing-library/jest-dom';

describe('BankfinUI Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <h1>Welcome to Bankfin</h1>
        <button id="startButton">Get Started</button>
      </div>
    `;
  });

  test('should show login form when clicking start button', () => {
    const ui = new BankfinUI();
    const startButton = document.getElementById('startButton');
    startButton.click();
    
    const loginForm = document.getElementById('loginForm');
    expect(loginForm).toBeInTheDocument();
  });
});
