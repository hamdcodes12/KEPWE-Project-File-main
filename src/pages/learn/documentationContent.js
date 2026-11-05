export const DOCS = [
  {
    slug: 'getting-started', title: 'Getting Started', intro: 'A quick route from creating your Kepwe account to exploring the Quant workspace.',
    sections: [
      { heading: 'Before you begin', body: 'Kepwe Quant is an algorithmic trading workspace. Access to protected workspace features depends on your trial or subscription status. Broker and execution availability can also depend on your account, plan, and configuration.' },
      { heading: 'Create your account', body: 'Open Sign up and follow the email verification steps shown on screen. If you already have an account, use Login and complete the requested authentication step. The application uses email sign-in codes where configured.', steps: ['Choose Sign up and enter the requested account details.', 'Complete the verification step sent to your email.', 'Return to Login when you are ready to open the workspace.'] },
      { heading: 'Open the Quant workspace', body: 'Choose Start Free Demo or Login from the website navigation. A new eligible account can activate one 24-hour demo from the Quant dashboard. The clock starts only after you activate it.', steps: ['Sign in to your Kepwe account.', 'Open the Quant dashboard.', 'If eligible, choose “Activate My Free Demo” to begin the 24-hour period.'] },
      { heading: 'Find your way around', body: 'Use the workspace navigation to open the dashboard, strategies, broker settings, analytics, and risk tools available to your account. The visible options depend on your current plan and permissions.', note: 'A demo is for the period shown by the dashboard. Workspace and API access are checked by the server.' },
    ],
  },
  {
    slug: 'introduction', title: 'Introduction to Kepwe Quant', intro: 'Kepwe Quant brings strategy configuration, broker connectivity, market activity, and risk controls into one trading workspace.',
    sections: [
      { heading: 'What is Kepwe Quant?', body: 'Kepwe Quant is an algorithmic trading platform designed to help users configure quantitative strategies and work with supported broker connectivity. It includes a dashboard, strategy tools, backtesting endpoints, analytics, and risk views, subject to account access and feature availability.' },
      { heading: 'Why use Kepwe Quant?', body: 'The workspace centralizes strategy parameters, supported broker status, trading activity, analytics, and risk controls. It is intended to make configuration and monitoring easier to follow.' },
      { heading: 'Who is it for?', body: 'It is for traders who want to explore systematic strategy workflows. Users should understand the instruments they trade and review strategy parameters, broker permissions, and risk limits before enabling any execution feature.' },
      { heading: 'What it does not promise', body: 'Quant tools do not guarantee returns or remove market risk. Backtests and illustrative analytics are not predictions of future results.' },
    ],
  },
  {
    slug: 'how-it-works', title: 'How Kepwe Quant Works', intro: 'A strategy turns explicit rules and parameters into conditions that can be reviewed and, where enabled, acted on through a supported broker.',
    sections: [
      { heading: 'The workflow', body: 'A typical workflow is to review the dashboard, create or configure a strategy, choose instruments and parameters, assess the available backtest, confirm risk settings, and monitor activity. Execution controls are subject to feature access, broker connection, and the platform’s deployment checks.', diagram: 'workflow' },
      { heading: 'Rules and signals', body: 'A strategy evaluates its configured market conditions. A signal is a rule result; it is not a promise of execution or a recommendation. Market data quality, timing, and broker availability can affect outcomes.' },
      { heading: 'Backtesting', body: 'Backtesting evaluates strategy rules against historical or sample data. It helps inspect how rules would have behaved under the selected assumptions. Fees, slippage, data limitations, and changing market conditions can make actual results differ.' },
      { heading: 'Automation and execution', body: 'Execution functionality is plan-gated and requires supported broker setup. Check the deployment validation and risk status in the workspace before relying on an execution workflow.', note: 'Never assume that saving a strategy means it is active or that a signal has placed an order.' },
    ],
  },
  {
    slug: 'account-authentication', title: 'Account & Authentication', intro: 'Use the account pages to sign in, verify your email, and manage your profile securely.',
    sections: [
      { heading: 'Register and sign in', body: 'Choose Sign up to create an account or Login to access an existing one. Follow the verification instructions shown in the app. Depending on configuration, authentication uses an email one-time code.' },
      { heading: 'Session access', body: 'Protected workspace routes require an authenticated session. If your session expires, sign in again. Signing in does not activate or restart a free demo.' },
      { heading: 'Account profile', body: 'Use Profile and Settings to review account details and available security settings. Keep your email account secure because it may be used to complete sign-in verification.' },
    ],
  },
  {
    slug: 'dashboard-overview', title: 'Dashboard Overview', intro: 'The Quant dashboard summarizes workspace access and the trading information available to your account.',
    sections: [
      { heading: 'Dashboard information', body: 'The dashboard can show account settings, strategy summaries, broker connection status, positions, recent activity, and risk information. Some panels require an active subscription, broker connection, or market data availability.' },
      { heading: 'Navigation', body: 'Use the workspace navigation to move between dashboard sections. If a section is unavailable, review your subscription status and required feature access.' },
      { heading: 'Market data status', body: 'Market data indicators reflect the configured provider and current availability. A missing or delayed feed can affect signal calculations and displayed values.' },
      { heading: 'Empty or unavailable panels', body: 'New accounts may not have strategies, broker connections, or activity yet. Connect a supported account and configure the relevant feature where available.' },
    ],
  },
  {
    slug: 'broker-integrations', title: 'Broker Integrations', intro: 'Kepwe Quant currently includes an Angel One broker connection flow. Other brokers are not presented as supported here.',
    sections: [
      { heading: 'Supported broker', body: 'The project includes Angel One connection and OAuth flows. Availability may depend on your plan, account verification, environment configuration, and the broker’s own service.' },
      { heading: 'Connect a broker', body: 'In the Quant workspace, open the broker section and choose the Angel One connection option. Complete the broker’s authorization steps and return to Kepwe. Check the connection status before using broker-dependent features.', steps: ['Open Broker in the Quant workspace.', 'Choose the Angel One connect option.', 'Review the requested authorization and continue with the broker.', 'Return to Kepwe and confirm the broker status reads connected.'] },
      { heading: 'Refresh or disconnect', body: 'Use the connection controls in the workspace to refresh or disconnect an account. Disconnect remains available as a safety action even when other subscription-gated broker operations are unavailable.' },
      { heading: 'Connection troubleshooting', body: 'If authorization fails, confirm you used the intended broker account, retry after checking the broker service, and review any error code shown in the app. Do not share broker credentials or authorization codes with support.', note: 'Broker connectivity does not guarantee order acceptance, market data availability, or execution.' },
    ],
  },
  {
    slug: 'strategy-management', title: 'Strategy Management', intro: 'Create and review strategy configurations using the strategy tools available to your Quant account.',
    sections: [
      { heading: 'Create a strategy', body: 'Open Strategies in the workspace and choose the create action. Enter a name, instrument, timeframe, and the strategy parameters requested by the form, then save. The server validates parameter ranges and feature access.', steps: ['Open Strategies and select the create action.', 'Enter the strategy name, instrument, and timeframe.', 'Review risk and strategy parameters, then save.', 'Reopen the saved strategy and confirm its configuration.'] },
      { heading: 'Strategy parameters', body: 'Parameters can include instrument, timeframe, capital allocation, per-trade risk, stop loss, target, and risk-to-reward settings. The exact fields vary by strategy. Review units and allowed ranges before saving.' },
      { heading: 'Review versions', body: 'When an existing strategy is edited, the platform records configuration versions for review. Confirm the saved version and its parameters before using it in any deployment workflow.' },
      { heading: 'Activation and deployment', body: 'A saved strategy is not necessarily executing. Use the platform’s deployment validation and status controls where enabled; access depends on an eligible plan, supported broker setup, and required checks.' },
    ],
  },
  {
    slug: 'risk-management', title: 'Risk Management', intro: 'Risk controls help define exposure limits and monitor conditions that may require attention.',
    sections: [
      { heading: 'Available controls', body: 'Strategy configuration includes risk-related parameters such as risk per trade, stop loss, target, and risk-to-reward ratio. Account-level settings can include trade limits and daily loss limits. Availability varies by feature access.' },
      { heading: 'Risk status', body: 'The workspace includes a risk status endpoint and risk event tracking. Review warnings and current status before using execution features.' },
      { heading: 'Emergency stop', body: 'The Quant API includes an emergency-stop operation. Use the corresponding workspace control if available when you need to halt the supported execution workflow, then verify the resulting status.' },
      { heading: 'Important limitations', body: 'Risk controls cannot prevent every loss, guarantee a fill price, or protect against all outages and market events. You remain responsible for reviewing strategy behavior and account exposure.' },
    ],
  },
  {
    slug: 'trading-execution', title: 'Trading Execution', intro: 'Execution depends on subscription entitlements, deployment checks, and a correctly configured supported broker.',
    sections: [
      { heading: 'Before deploying', body: 'Confirm the strategy configuration, required risk settings, broker connection, market data state, and deployment validation. Resolve failed prerequisites before proceeding.' },
      { heading: 'Order workflow', body: 'The project contains broker execution and order-status handling for supported workflows. Broker APIs can reject, delay, or partially fill requests. Monitor order and position status rather than assuming a request succeeded.' },
      { heading: 'Live execution access', body: 'Live execution is a separately gated feature. A demo or a saved strategy does not by itself enable real orders. The deployment gate and your plan determine whether the operation is available.' },
      { heading: 'Safety', body: 'Use conservative settings and understand the consequences before enabling execution. Disconnecting a broker or using the emergency stop can be appropriate when connection or strategy behavior is unclear.' },
    ],
  },
  {
    slug: 'demo-free-trial', title: 'Demo & Free Trial', intro: 'Eligible new users can activate one free demo that lasts exactly 24 hours from activation.',
    sections: [
      { heading: 'Activate your demo', body: 'Sign in, open the Quant dashboard, and select “Activate My Free Demo.” The timer does not start during registration or login. Only one activation is allowed per account.', steps: ['Sign in to the eligible account.', 'Open the Quant dashboard.', 'Select “Activate My Free Demo” and confirm the dashboard shows the active state.'] },
      { heading: 'Countdown and expiry', body: 'The dashboard countdown is based on the server-stored activation and expiry timestamps. Refreshing, logging out, or changing your device clock does not reset or extend access. At the expiry timestamp, protected Quant endpoints deny trial access.' },
      { heading: 'After the demo', body: 'When the 24-hour period ends, the dashboard shows the expired-trial state and provides an upgrade path. An active paid subscription can restore access according to its plan entitlements.' },
      { heading: 'Trial boundaries', body: 'The demo is one-time and is not extended by relogging or browser storage changes. Availability of broker and live execution features remains controlled by plan permissions.', note: 'The demo is not a promise of trading performance or a source of guaranteed returns.' },
    ],
  },
  {
    slug: 'pricing-subscription', title: 'Pricing & Subscription', intro: 'Plans control access to Quant features. Review the current pricing page for available plans and terms.',
    sections: [
      { heading: 'Compare plans', body: 'Open Pricing to review current Quant plans, feature limits, and displayed terms. Plan names and entitlements are supplied by the application and may change over time.' },
      { heading: 'Upgrade', body: 'Choose an available plan and follow the checkout flow. The app verifies payment before updating subscription access. Do not share payment credentials outside the secure checkout experience.', steps: ['Open Pricing and compare the displayed plans and entitlements.', 'Select a plan and complete the checkout flow.', 'Return to Kepwe and verify the account subscription status.'] },
      { heading: 'Manage a subscription', body: 'Authenticated users can view subscription status and payment history in the account or Quant workspace. Cancellation and reactivation options depend on the subscription state.' },
      { heading: 'Access checks', body: 'Protected API operations enforce active subscription and feature entitlements on the server. Hiding a button in the interface is not the only access control.' },
    ],
  },
  {
    slug: 'security', title: 'Security', intro: 'Use account and broker authorization carefully, and review access before enabling sensitive features.',
    sections: [
      { heading: 'Sign-in safety', body: 'Use a unique password where applicable and protect the mailbox used for sign-in codes. Never share one-time codes or session links.' },
      { heading: 'Broker authorization', body: 'Authorize the broker only through the in-app connection flow. Do not paste broker passwords, API secrets, or authorization codes into chat or support forms.' },
      { heading: 'Access control', body: 'Quant APIs require authentication and enforce subscription and feature gates for protected actions. Sign out on shared devices and report account activity you do not recognize.' },
      { heading: 'Responsible use', body: 'Keep devices and browsers updated. Review all permissions requested during broker authorization and disconnect access you no longer need.' },
    ],
  },
  {
    slug: 'troubleshooting', title: 'Troubleshooting', intro: 'Use these checks for common sign-in, dashboard, broker, and strategy issues.',
    sections: [
      { heading: 'I cannot sign in', body: 'Check that you entered the correct account email and complete the latest verification step. If a code expired, request a new one. Check spam or filtered mail folders.' },
      { heading: 'The dashboard says access is unavailable', body: 'Review your trial or subscription status and plan entitlements. If the 24-hour demo has expired, activate an eligible paid plan to restore the features it includes.' },
      { heading: 'Broker connection failed', body: 'Confirm the broker authorization completed, retry the connection flow, and check the displayed broker error. Broker-side outages and account restrictions can prevent a connection.' },
      { heading: 'A strategy will not save or deploy', body: 'Check required fields and parameter ranges. Deployment also requires the relevant feature entitlement, supported broker connection, and passing validation checks.' },
      { heading: 'Market data is missing', body: 'Check the market data status indicator and provider availability. Retry later if the provider is unavailable; do not treat missing values as zero or as a valid signal.' },
    ],
  },
  {
    slug: 'faq', title: 'Frequently Asked Questions', intro: 'Quick answers about using Kepwe Quant.',
    sections: [
      { heading: 'Is Kepwe Quant free?', body: 'Eligible new users can activate a one-time 24-hour free demo. Check Pricing for current plans and terms after the demo.' },
      { heading: 'When does the demo timer start?', body: 'Only when you click “Activate My Free Demo.” Registration and login do not start the timer.' },
      { heading: 'Can I reset or extend my demo?', body: 'No. The account receives one activation, and the server-stored expiry is not extended by refreshing, signing out, or changing device time.' },
      { heading: 'Which broker is supported?', body: 'The current project includes an Angel One broker connection flow. Check the in-app broker section for current availability.' },
      { heading: 'Does a backtest predict results?', body: 'No. A backtest evaluates rules under selected historical assumptions and cannot predict future performance.' },
      { heading: 'What is Kepwe Learn?', body: 'Kepwe Learn is the product documentation and help center for the Kepwe Quant workspace.' },
      { heading: 'Where do I get more help?', body: 'Use the Contact page or the support options shown in your account to report a product issue. Include the page and any non-sensitive error code; never include passwords, OTPs, broker secrets, or payment details.' },
    ],
  },
];
