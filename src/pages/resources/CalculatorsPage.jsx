import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calculator, 
  ArrowRight, 
  Receipt, 
  Landmark, 
  Briefcase, 
  Wallet, 
  TrendingUp, 
  Percent, 
  HelpCircle,
  ChevronDown,
  Check
} from 'lucide-react';
import './CalculatorsPage.css';

const CalculatorSelect = ({ value, onChange, options, ariaLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        if (currentIndex < options.length - 1) {
          onChange(options[currentIndex + 1].value);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        if (currentIndex > 0) {
          onChange(options[currentIndex - 1].value);
        }
      }
    }
  };

  return (
    <div className="calc-select-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`calc-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || 'Select option'}
      >
        <span className="calc-select-value">{selectedOption ? selectedOption.label : ''}</span>
        <ChevronDown size={18} className={`calc-select-chevron ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="calc-dropdown-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`calc-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={16} className="calc-option-check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const formatINR = (val) => {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
};

const formatPercent = (val) => {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '0%';
  return `${Number(val).toFixed(1)}%`;
};

const CalculatorsPage = () => {
  const [selectedCalc, setSelectedCalc] = useState('gst');

  // 1. GST Calculator State
  const [gstAmount, setGstAmount] = useState(10000);
  const [gstRate, setGstRate] = useState(18);
  const [gstMode, setGstMode] = useState('exclusive'); // 'exclusive' (add GST) or 'inclusive' (remove GST)

  // GST Calculations
  const safeGstAmount = Math.max(0, Number(gstAmount) || 0);
  const safeGstRate = Math.max(0, Number(gstRate) || 0);
  
  let baseAmount = 0;
  let calculatedGst = 0;
  let totalGstAmount = 0;

  if (gstMode === 'exclusive') {
    baseAmount = safeGstAmount;
    calculatedGst = (safeGstAmount * safeGstRate) / 100;
    totalGstAmount = safeGstAmount + calculatedGst;
  } else {
    baseAmount = safeGstAmount / (1 + safeGstRate / 100);
    calculatedGst = safeGstAmount - baseAmount;
    totalGstAmount = safeGstAmount;
  }

  // 2. EMI Calculator State
  const [emiLoanAmount, setEmiLoanAmount] = useState(500000);
  const [emiInterestRate, setEmiInterestRate] = useState(10.5);
  const [emiTenureYears, setEmiTenureYears] = useState(3);

  // EMI Calculations (Standard reducing-balance formula)
  const safeEmiLoan = Math.max(0, Number(emiLoanAmount) || 0);
  const safeEmiRate = Math.max(0.1, Number(emiInterestRate) || 0);
  const safeEmiTenure = Math.max(1, Number(emiTenureYears) || 1);

  const monthlyRate = safeEmiRate / 12 / 100;
  const totalMonths = safeEmiTenure * 12;
  const calculatedEmi = Math.round(
    (safeEmiLoan * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1)
  ) || 0;
  const totalEmiPayment = calculatedEmi * totalMonths;
  const totalEmiInterest = Math.max(0, totalEmiPayment - safeEmiLoan);

  // 3. Business Loan Calculator State
  const [bizLoanAmount, setBizLoanAmount] = useState(1000000);
  const [bizInterestRate, setBizInterestRate] = useState(12.0);
  const [bizTenureYears, setBizTenureYears] = useState(3);

  // Business Loan Calculations
  const safeBizLoan = Math.max(0, Number(bizLoanAmount) || 0);
  const safeBizRate = Math.max(0.1, Number(bizInterestRate) || 0);
  const safeBizTenure = Math.max(1, Number(bizTenureYears) || 1);

  const bizMonthlyRate = safeBizRate / 12 / 100;
  const bizTotalMonths = safeBizTenure * 12;
  const calculatedBizEmi = Math.round(
    (safeBizLoan * bizMonthlyRate * Math.pow(1 + bizMonthlyRate, bizTotalMonths)) /
    (Math.pow(1 + bizMonthlyRate, bizTotalMonths) - 1)
  ) || 0;
  const totalBizPayment = calculatedBizEmi * bizTotalMonths;
  const totalBizInterest = Math.max(0, totalBizPayment - safeBizLoan);

  // 4. Salary Calculator State
  const [annualCtc, setAnnualCtc] = useState(1200000);
  const [profTax, setProfTax] = useState(200);
  const [includePf, setIncludePf] = useState(true);

  // Salary Calculations (Standard Indian Payroll model)
  const safeCtc = Math.max(0, Number(annualCtc) || 0);
  const monthlyGross = safeCtc / 12;
  const basicSalary = monthlyGross * 0.5; // Standard 50% basic
  const employeePf = includePf ? Math.min(basicSalary * 0.12, 1800) : 0;
  const safeProfTax = Number(profTax) || 0;
  
  // Approximate standard annual tax bracket calculation
  let annualTax = 0;
  if (safeCtc > 1500000) {
    annualTax = (safeCtc - 1500000) * 0.3 + 150000;
  } else if (safeCtc > 1000000) {
    annualTax = (safeCtc - 1000000) * 0.2 + 50000;
  } else if (safeCtc > 700000) {
    annualTax = (safeCtc - 700000) * 0.1;
  }
  const monthlyTax = annualTax / 12;
  const monthlyDeductions = employeePf + safeProfTax + monthlyTax;
  const monthlyTakeHome = Math.max(0, monthlyGross - monthlyDeductions);

  // 5. Profit Margin Calculator State
  const [revenue, setRevenue] = useState(500000);
  const [cost, setCost] = useState(320000);

  // Profit Margin Calculations
  const safeRevenue = Math.max(0, Number(revenue) || 0);
  const safeCost = Math.max(0, Number(cost) || 0);
  const grossProfit = safeRevenue - safeCost;
  const profitMarginPercent = safeRevenue > 0 ? (grossProfit / safeRevenue) * 100 : 0;
  const markupPercent = safeCost > 0 ? (grossProfit / safeCost) * 100 : 0;

  const calculatorTabs = [
    { id: 'gst', name: 'GST Calculator', icon: Receipt },
    { id: 'emi', name: 'EMI Calculator', icon: Landmark },
    { id: 'loan', name: 'Business Loan Calculator', icon: Briefcase },
    { id: 'salary', name: 'Salary Calculator', icon: Wallet },
    { id: 'margin', name: 'Profit Margin Calculator', icon: TrendingUp },
  ];

  return (
    <div className="calc-page-container">
      <div className="calc-content-wrapper">
        {/* Header */}
        <div className="calc-header-block">
          <span className="calc-badge">
            FREE BUSINESS TOOLS · /resources/calculators
          </span>
          <h1 className="calc-main-title">
            Free Business & Tax Calculators
          </h1>
          <p className="calc-subtitle">
            Instant, accurate calculations for GST, Loans, EMI, Payroll Salary, and Profit Margins.
          </p>
        </div>

        {/* Calculator Selector Tabs */}
        <div className="calc-nav-tabs" role="tablist">
          {calculatorTabs.map((tab) => {
            const IconComp = tab.icon;
            const isActive = selectedCalc === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCalc(tab.id)}
                className={`calc-tab-btn ${isActive ? 'is-active' : ''}`}
              >
                <IconComp size={16} color={isActive ? '#FFFFFF' : '#214ECF'} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* 1. GST CALCULATOR */}
        {selectedCalc === 'gst' && (
          <div className="calc-main-card">
            <div className="calc-card-header">
              <div className="calc-card-icon-wrap">
                <Receipt size={22} />
              </div>
              <div>
                <h2 className="calc-card-title">GST Tax Calculator</h2>
                <p className="calc-card-desc">Calculate GST amount, base price, and total invoice value for any tax slab.</p>
              </div>
            </div>

            <div className="calc-inputs-grid cols-3">
              {/* Input Amount */}
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Amount (₹)</span>
                  <span className="calc-label-hint">Base / Total</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="10000"
                  />
                </div>
              </div>

              {/* GST Rate Slab */}
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>GST Rate Slab</span>
                  <span className="calc-label-hint">Standard rates</span>
                </label>
                <CalculatorSelect
                  value={gstRate}
                  onChange={(val) => setGstRate(val)}
                  ariaLabel="GST Rate Slab"
                  options={[
                    { value: 5, label: '5% (Essential Goods & Transport)' },
                    { value: 12, label: '12% (Standard Processed Goods)' },
                    { value: 18, label: '18% (Services, IT & Manufacturing)' },
                    { value: 28, label: '28% (Luxury & Automotive)' },
                  ]}
                />
              </div>

              {/* Calculation Mode Toggle */}
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Calculation Mode</span>
                  <span className="calc-label-hint">Tax inclusion</span>
                </label>
                <div className="calc-mode-toggle-wrap">
                  <button
                    type="button"
                    onClick={() => setGstMode('exclusive')}
                    className={`calc-mode-btn ${gstMode === 'exclusive' ? 'is-active' : ''}`}
                  >
                    GST Exclusive (+GST)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstMode('inclusive')}
                    className={`calc-mode-btn ${gstMode === 'inclusive' ? 'is-active' : ''}`}
                  >
                    GST Inclusive (Gross)
                  </button>
                </div>
              </div>
            </div>

            {/* Results Output */}
            <div className="calc-result-panel">
              <span className="calc-result-sublabel">TOTAL INVOICE AMOUNT</span>
              <div className="calc-result-main-value">{formatINR(totalGstAmount)}</div>

              <div className="calc-result-metrics-grid">
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Base / Net Amount</span>
                  <span className="calc-metric-value">{formatINR(baseAmount)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">GST Value ({safeGstRate}%)</span>
                  <span className="calc-metric-value highlight-blue">{formatINR(calculatedGst)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">CGST ({safeGstRate / 2}%)</span>
                  <span className="calc-metric-value">{formatINR(calculatedGst / 2)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">SGST / UTGST ({safeGstRate / 2}%)</span>
                  <span className="calc-metric-value">{formatINR(calculatedGst / 2)}</span>
                </div>
              </div>
            </div>

            {/* Contextual CTA */}
            <div className="calc-cta-strip">
              <span className="calc-cta-message">Want an expert CA to review your calculations and file your GST returns?</span>
              <Link to="/gst" className="calc-cta-button">
                <span>Explore GST Return Filing</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* 2. EMI CALCULATOR */}
        {selectedCalc === 'emi' && (
          <div className="calc-main-card">
            <div className="calc-card-header">
              <div className="calc-card-icon-wrap">
                <Landmark size={22} />
              </div>
              <div>
                <h2 className="calc-card-title">Loan EMI Calculator</h2>
                <p className="calc-card-desc">Calculate your monthly installments, total interest, and total repayment schedule.</p>
              </div>
            </div>

            <div className="calc-inputs-grid cols-3">
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Loan Amount (₹)</span>
                  <span className="calc-label-hint">Principal</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    value={emiLoanAmount}
                    onChange={(e) => setEmiLoanAmount(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="500000"
                  />
                </div>
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Interest Rate (% p.a.)</span>
                  <span className="calc-label-hint">Annual rate</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  step="0.1"
                  value={emiInterestRate}
                  onChange={(e) => setEmiInterestRate(e.target.value)}
                  className="calc-input"
                  placeholder="10.5"
                />
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Tenure (Years)</span>
                  <span className="calc-label-hint">{safeEmiTenure * 12} Months</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={emiTenureYears}
                  onChange={(e) => setEmiTenureYears(e.target.value)}
                  className="calc-input"
                  placeholder="3"
                />
              </div>
            </div>

            {/* Results Output */}
            <div className="calc-result-panel">
              <span className="calc-result-sublabel">MONTHLY EMI ESTIMATE</span>
              <div className="calc-result-main-value">{formatINR(calculatedEmi)}</div>

              <div className="calc-result-metrics-grid">
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Principal Loan Amount</span>
                  <span className="calc-metric-value">{formatINR(safeEmiLoan)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Interest Payable</span>
                  <span className="calc-metric-value highlight-blue">{formatINR(totalEmiInterest)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Amount Payable</span>
                  <span className="calc-metric-value highlight-green">{formatINR(totalEmiPayment)}</span>
                </div>
              </div>
            </div>

            {/* Contextual CTA */}
            <div className="calc-cta-strip">
              <span className="calc-cta-message">Check how much loan eligibility you have across our network of top RBI lenders.</span>
              <Link to="/credit/eligibility" className="calc-cta-button">
                <span>Check Loan Eligibility</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* 3. BUSINESS LOAN CALCULATOR */}
        {selectedCalc === 'loan' && (
          <div className="calc-main-card">
            <div className="calc-card-header">
              <div className="calc-card-icon-wrap">
                <Briefcase size={22} />
              </div>
              <div>
                <h2 className="calc-card-title">Business Loan EMI Calculator</h2>
                <p className="calc-card-desc">Estimate monthly repayments, total interest, and working capital cash flow.</p>
              </div>
            </div>

            <div className="calc-inputs-grid cols-3">
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Loan Amount (₹)</span>
                  <span className="calc-label-hint">Working capital / Term</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="50000"
                    step="50000"
                    value={bizLoanAmount}
                    onChange={(e) => setBizLoanAmount(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="1000000"
                  />
                </div>
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Interest Rate (% p.a.)</span>
                  <span className="calc-label-hint">Fixed / Floating</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  step="0.1"
                  value={bizInterestRate}
                  onChange={(e) => setBizInterestRate(e.target.value)}
                  className="calc-input"
                  placeholder="12.0"
                />
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Tenure (Years)</span>
                  <span className="calc-label-hint">{safeBizTenure * 12} Months</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={bizTenureYears}
                  onChange={(e) => setBizTenureYears(e.target.value)}
                  className="calc-input"
                  placeholder="3"
                />
              </div>
            </div>

            {/* Results Output */}
            <div className="calc-result-panel">
              <span className="calc-result-sublabel">MONTHLY EMI ESTIMATE</span>
              <div className="calc-result-main-value">{formatINR(calculatedBizEmi)}</div>

              <div className="calc-result-metrics-grid">
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Principal Amount</span>
                  <span className="calc-metric-value">{formatINR(safeBizLoan)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Interest Payable</span>
                  <span className="calc-metric-value highlight-blue">{formatINR(totalBizInterest)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Repayment Amount</span>
                  <span className="calc-metric-value highlight-green">{formatINR(totalBizPayment)}</span>
                </div>
              </div>
            </div>

            {/* Contextual CTA */}
            <div className="calc-cta-strip">
              <span className="calc-cta-message">Need working capital, machinery loans, or invoice discounting?</span>
              <Link to="/credit/eligibility" className="calc-cta-button">
                <span>Check Loan Eligibility</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* 4. SALARY CALCULATOR */}
        {selectedCalc === 'salary' && (
          <div className="calc-main-card">
            <div className="calc-card-header">
              <div className="calc-card-icon-wrap">
                <Wallet size={22} />
              </div>
              <div>
                <h2 className="calc-card-title">Salary & Take-Home Calculator</h2>
                <p className="calc-card-desc">Calculate estimated monthly in-hand salary, annual gross, and statutory payroll deductions.</p>
              </div>
            </div>

            <div className="calc-inputs-grid cols-3">
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Annual CTC (₹)</span>
                  <span className="calc-label-hint">Cost to Company</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="100000"
                    step="50000"
                    value={annualCtc}
                    onChange={(e) => setAnnualCtc(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="1200000"
                  />
                </div>
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Professional Tax (₹/mo)</span>
                  <span className="calc-label-hint">Standard ₹200</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    max="2500"
                    value={profTax}
                    onChange={(e) => setProfTax(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="200"
                  />
                </div>
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Provident Fund (PF)</span>
                  <span className="calc-label-hint">12% of Basic</span>
                </label>
                <div className="calc-mode-toggle-wrap">
                  <button
                    type="button"
                    onClick={() => setIncludePf(true)}
                    className={`calc-mode-btn ${includePf ? 'is-active' : ''}`}
                  >
                    Deduct EPF (12%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncludePf(false)}
                    className={`calc-mode-btn ${!includePf ? 'is-active' : ''}`}
                  >
                    Opt-out EPF
                  </button>
                </div>
              </div>
            </div>

            {/* Results Output */}
            <div className="calc-result-panel">
              <span className="calc-result-sublabel">ESTIMATED MONTHLY TAKE-HOME PAY</span>
              <div className="calc-result-main-value">{formatINR(monthlyTakeHome)}</div>

              <div className="calc-result-metrics-grid">
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Monthly Gross Salary</span>
                  <span className="calc-metric-value">{formatINR(monthlyGross)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Monthly EPF Contribution</span>
                  <span className="calc-metric-value">{formatINR(employeePf)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Est. Monthly Tax (TDS)</span>
                  <span className="calc-metric-value">{formatINR(monthlyTax)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Monthly Deductions</span>
                  <span className="calc-metric-value highlight-blue">{formatINR(monthlyDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Contextual CTA */}
            <div className="calc-cta-strip">
              <span className="calc-cta-message">Need seamless automated payroll processing, payslips & tax compliance?</span>
              <Link to="/free-compliance-check" className="calc-cta-button">
                <span>Set Up Automated Payroll</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* 5. PROFIT MARGIN CALCULATOR */}
        {selectedCalc === 'margin' && (
          <div className="calc-main-card">
            <div className="calc-card-header">
              <div className="calc-card-icon-wrap">
                <TrendingUp size={22} />
              </div>
              <div>
                <h2 className="calc-card-title">Profit Margin Calculator</h2>
                <p className="calc-card-desc">Calculate gross profit, net margin percentage, and cost markup dynamically.</p>
              </div>
            </div>

            <div className="calc-inputs-grid cols-2">
              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Revenue / Sales (₹)</span>
                  <span className="calc-label-hint">Total selling price</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="500000"
                  />
                </div>
              </div>

              <div className="calc-input-group">
                <label className="calc-label">
                  <span>Cost / Expenses (₹)</span>
                  <span className="calc-label-hint">Cost of goods & operations</span>
                </label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="calc-input has-prefix"
                    placeholder="320000"
                  />
                </div>
              </div>
            </div>

            {/* Results Output */}
            <div className="calc-result-panel">
              <span className="calc-result-sublabel">GROSS PROFIT MARGIN</span>
              <div className="calc-result-main-value">{formatPercent(profitMarginPercent)}</div>

              <div className="calc-result-metrics-grid">
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Gross Profit Amount</span>
                  <span className={`calc-metric-value ${grossProfit >= 0 ? 'highlight-green' : ''}`}>
                    {formatINR(grossProfit)}
                  </span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Revenue</span>
                  <span className="calc-metric-value">{formatINR(safeRevenue)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Total Cost</span>
                  <span className="calc-metric-value">{formatINR(safeCost)}</span>
                </div>
                <div className="calc-metric-item">
                  <span className="calc-metric-label">Cost Markup %</span>
                  <span className="calc-metric-value highlight-blue">{formatPercent(markupPercent)}</span>
                </div>
              </div>
            </div>

            {/* Contextual CTA */}
            <div className="calc-cta-strip">
              <span className="calc-cta-message">Looking to optimize unit economics, pricing strategies, and cash flow forecasting?</span>
              <Link to="/virtual-cfo" className="calc-cta-button">
                <span>Talk to a Virtual CFO</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculatorsPage;
