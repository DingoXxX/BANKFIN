# Secure Banking App API
Now with working /register, /login, and /deposit endpoints!
# 💸 Bankfin – Money Moves, Your Way

Bankfin empowers a new generation to **take control of their financial future** with intelligent investing, collaborative finance, and reward-based engagement—**without compromising privacy or personality**.

---

## 🎯 Theme: *Money Moves, Your Way*

Designed for **Gen Z**, Bankfin makes money management feel personal, social, and fun. It’s not just about investing—it’s about creating habits, building communities, and celebrating financial wins, big or small.

---

## 🌟 Key Features

### 🧠 AI-Powered Smart Investing
- **Personalized Investment Recommendations**: Get suggestions tailored to your spending patterns and lifestyle.
- **Round-Up Investing**: Automatically round up purchases and invest the change toward your financial goals.
- **Digestible Market Trends**: Let AI translate complex market shifts into engaging, easy-to-understand insights.

### 👥 Community Finance & Social Engagement
- **Group Investing**: Collaborate with friends to hit shared savings or investment goals.
- **Crowdsourced Investment Polls**: Vote on trending assets and make collective decisions.
- **Gamified Financial Challenges**: Leaderboards, streaks, and milestones to make progress feel like a game.

### 🕵️ Privacy & Stealth Mode
- **Private Transactions**: Choose what to share and what stays hidden.
- **Stealth Accounts**: Create secret savings or investment accounts for personal goals or surprises.
- **Decentralized Security Options**: Use blockchain-backed transparency and safety—only if you want to.

### 🎁 Surprise Rewards & Incentives
- **Dynamic Prize Tiers**: Unlock mystery rewards as you invest, not just boring cashback.
- **Referral Boosts**: Bring friends onboard and get rewarded financially.
- **Mystery Spins**: Earn bonus spins for financial prizes based on your activity.

---

## 👶 Built for Gen Z

Bankfin taps into what Gen Z values most:
- 🎯 **Control** over their money
- 🎨 **Personalization** of financial experience
- 🤝 **Community-driven** investing
- 🔒 **Privacy** without complexity
- 🕹️ **Gamification** that makes finances fun

---

## 🚀 Coming Soon...

Stay tuned for:
- Mobile app releases
- Real-time stock insights & crypto tracking
- NFT-based achievement badges
- DAO-based group investing governance

---

## 🤝 Get Involved

Interested in contributing, testing, or partnering?  
Reach out or fork the project and help us redefine what financial freedom means for the next generation.

---


---OR---


> Bankfin – Because financial freedom should be fun, social, and totally yours.

# 💸 Bankfin – Money Moves, Your Way

**Now with working `/register`, `/login`, and `/deposit` endpoints!**  
A secure and social banking API built for the next generation of financial empowerment.

---

## 🧠 What Is Bankfin?

Bankfin empowers a new generation to **take control of their financial future** with intelligent investing, collaborative finance, and reward-based engagement—**without compromising privacy or personality**.

---

## 🎯 Theme: *Money Moves, Your Way*

Built for **Gen Z**, Bankfin turns financial management into a **personal, social, and rewarding experience**. It’s more than banking—it's a movement.

---

## 🌟 Key Features

### 🧠 AI-Powered Smart Investing
- Personalized investment suggestions
- Round-up investing toward financial goals
- Digestible, AI-curated market insights

### 👥 Social Finance
- Group investing with friends
- Crowdsourced decision-making
- Gamified leaderboards and challenges

### 🕵️ Privacy by Default
- Private transactions & stealth accounts
- Optional blockchain-backed security

### 🎁 Surprise & Delight
- Mystery rewards and financial boosts
- Referral perks and spin-to-win prizes

---

## 📡 API Endpoints (Live)

These endpoints are part of the Bankfin backend (`FastAPI`, JWT auth, and SQLAlchemy-based DB):

### 🔐 `/auth/register`
- `POST`
- Body: `{ "email": "user@example.com", "password": "test123" }`
- Creates a new user.

### 🔑 `/auth/login`
- `POST`
- Form data: `username`, `password`
- Returns: `{ "access_token": "xxx", "token_type": "bearer" }`

### 💰 `/deposit`
- `POST`
- Headers: `Authorization: Bearer <token>`
- Body: `{ "amount": 100.00 }`
- Adds a deposit to the user’s account.

---

## 🧪 Local Development

### 🐳 Docker

```bash
docker-compose up --build
