/**
 * @jest-environment jsdom
 */
import { BankfinUI } from './webUi.js';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';

describe('BankfinUI', () => {
    let ui;
    
    beforeEach(() => {
        // Set up a clean DOM before each test
        document.body.innerHTML = `
            <div class="container">
                <h1>Welcome to Bankfin</h1>
                <p>Your financial management solution.</p>
                <button id="startButton">Get Started</button>
            </div>
        `;
        ui = new BankfinUI();
    });

    test('should show login form when start button is clicked', () => {
        const startButton = document.getElementById('startButton');
        fireEvent.click(startButton);

        const loginForm = document.getElementById('loginForm');
        expect(loginForm).toBeInTheDocument();
        expect(document.querySelector('input[type="email"]')).toBeInTheDocument();
        expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    });

    test('should handle login submission', async () => {
        // Mock fetch for login request
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ access_token: 'fake-token' }),
            })
        );

        // Click start to show login form
        fireEvent.click(document.getElementById('startButton'));

        // Fill in login form
        const emailInput = document.querySelector('input[type="email"]');
        const passwordInput = document.querySelector('input[type="password"]');
        const form = document.getElementById('loginForm');

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.submit(form);

        await waitFor(() => {
            // Check if dashboard is shown
            expect(document.querySelector('#balance')).toBeInTheDocument();
            expect(document.querySelector('#depositButton')).toBeInTheDocument();
        });

        // Verify fetch was called with correct data
        expect(fetch).toHaveBeenCalledWith('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password123',
            }),
        });
    });

    test('should show error message on login failure', async () => {
        // Mock fetch to simulate failure
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
            })
        );

        // Click start to show login form
        fireEvent.click(document.getElementById('startButton'));

        // Fill and submit login form
        const emailInput = document.querySelector('input[type="email"]');
        const passwordInput = document.querySelector('input[type="password"]');
        const form = document.getElementById('loginForm');

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(document.querySelector('.error-message')).toBeInTheDocument();
            expect(document.querySelector('.error-message')).toHaveTextContent('Login failed');
        });
    });
});
