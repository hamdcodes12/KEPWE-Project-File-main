import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  User, 
  Briefcase, 
  IndianRupee, 
  Home, 
  GraduationCap, 
  Plane, 
  HeartPulse, 
  ShoppingBag, 
  RefreshCw, 
  Sparkles, 
  SlidersHorizontal, 
  FileText, 
  Lock, 
  HelpCircle,
  ChevronRight,
  Info,
  Check,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  AlertCircle,
  UploadCloud,
  FileCheck2,
  Trash2,
  KeyRound,
  Shield,
  Fingerprint,
  Image,
  BadgeCheck,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { apiFetch } from '../../api/client.js';
import './CreditEligibilityPage.css';

const STEPS_NAV = [
  { id: 1, label: 'Requirement' },
  { id: 2, label: 'Purpose' },
  { id: 3, label: 'Employment' },
  { id: 4, label: 'Income' },
  { id: 5, label: 'Personal & KYC' }
];

const LOAN_AMOUNTS = [
  { label: '₹50,000', value: 50000 },
  { label: '₹1,00,000', value: 100000 },
  { label: '₹2,00,000', value: 200000, recommended: true },
  { label: '₹5,00,000', value: 500000 },
  { label: '₹10,00,000+', value: 1000000 }
];

const PURPOSES = [
  { id: 'home', label: 'Home Expenses', desc: 'Renovation, interiors or repairs', icon: Home },
  { id: 'education', label: 'Education', desc: 'Higher studies or certifications', icon: GraduationCap },
  { id: 'travel', label: 'Travel', desc: 'Family holidays or essential trips', icon: Plane },
  { id: 'emergency', label: 'Emergency Expenses', desc: 'Medical or unforeseen urgency', icon: HeartPulse },
  { id: 'purchase', label: 'Major Purchase', desc: 'Electronics, vehicles, appliances', icon: ShoppingBag },
  { id: 'consolidation', label: 'Debt Consolidation', desc: 'Combine multiple payments', icon: RefreshCw },
  { id: 'other', label: 'Other Personal Need', desc: 'General financial requirement', icon: Sparkles }
];

const EMPLOYMENT_TYPES = [
  { id: 'salaried', label: 'Salaried Employee', desc: 'Working in Private, Public or Govt sector', icon: Briefcase },
  { id: 'self-employed', label: 'Self-Employed Professional', desc: 'Doctors, CAs, Consultants, Architects', icon: User },
  { id: 'business', label: 'Business Owner / Partner', desc: 'Proprietorship, LLP, Pvt Ltd', icon: Building2 },
  { id: 'other', label: 'Other Profile', desc: 'Freelancer / Independent Contractor', icon: Sparkles }
];

const SAMPLE_LOAN_OPTIONS = [
  {
    id: 'opt-1',
    lenderName: 'Axis Finance Partner',
    planName: 'Flexi Personal Credit',
    tag: 'Lowest Interest',
    tagType: 'badge-blue',
    amount: 250000,
    tenure: 24,
    interestRate: 10.49,
    emi: 11590,
    processingFee: '1.25% + GST',
    prepaymentTerms: 'Zero penalty after 6 months',
    apr: '11.2%',
    features: ['Instant digital in-principle approval', 'Flexible tenure up to 48 months', 'Minimal documentation'],
    disbursalTime: '24 - 48 Hours'
  },
  {
    id: 'opt-2',
    lenderName: 'HDFC Lending Ecosystem',
    planName: 'Express Credit Line',
    tag: 'Fastest Disbursal',
    tagType: 'badge-green',
    amount: 250000,
    tenure: 24,
    interestRate: 10.99,
    emi: 11650,
    processingFee: '0.99% + GST',
    prepaymentTerms: 'Part-payment allowed at no cost',
    apr: '11.5%',
    features: ['Paperless KYC verification', 'Zero foreclosure fee on closing', 'Transparent fixed rate'],
    disbursalTime: 'Same Day Digital'
  },
  {
    id: 'opt-3',
    lenderName: 'Tata Capital Ecosystem',
    planName: 'Custom Term Loan',
    tag: 'Flexible Tenure',
    tagType: 'badge-purple',
    amount: 250000,
    tenure: 36,
    interestRate: 11.25,
    emi: 8215,
    processingFee: '1.5% + GST',
    prepaymentTerms: 'Standard partner terms apply',
    apr: '11.9%',
    features: ['Low monthly EMI burden', 'No hidden charges', 'Option to top-up later'],
    disbursalTime: '1 - 2 Business Days'
  }
];

const INDIAN_STATES_CITIES = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Anantapur', 'Kadapa', 'Other'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Other'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Other'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Other'],
  'Chandigarh': ['Chandigarh', 'Other'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Other'],
  'Delhi': ['New Delhi', 'Central Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi', 'Dwarka', 'Rohini', 'Connaught Place', 'Saket', 'Other'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Other'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Navsari', 'Other'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Other'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Kullu', 'Manali', 'Other'],
  'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Other'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Other'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Shivamogga', 'Other'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Kannur', 'Alappuzha', 'Palakkad', 'Kottayam', 'Other'],
  'Ladakh': ['Leh', 'Kargil', 'Other'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Other'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Navi Mumbai', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Other'],
  'Manipur': ['Imphal', 'Churachandpur', 'Thoubal', 'Other'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Other'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Other'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Other'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Other'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam', 'Other'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali (SAS Nagar)', 'Hoshiarpur', 'Pathankot', 'Other'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Other'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Other'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Other'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Secunderabad', 'Other'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Other'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Greater Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut', 'Bareilly', 'Gorakhpur', 'Other'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh', 'Nainital', 'Other'],
  'West Bengal': ['Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Malda', 'Other']
};

const CreditEligibilityPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(location.pathname === '/credit/results' ? 6 : 1);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedOptionModal, setSelectedOptionModal] = useState(null);

  // Form State (Step 1-4)
  const [amount, setAmount] = useState(200000);
  const [customAmount, setCustomAmount] = useState('');
  const [purpose, setPurpose] = useState('home');
  const [employmentType, setEmploymentType] = useState('salaried');
  const [monthlyIncome, setMonthlyIncome] = useState(65000);

  // Step 5: Sub-stages ('details' -> 'aadhaar_docs' -> 'otp' -> 'verified')
  const [aadhaarStage, setAadhaarStage] = useState('details');

  const [personalDetails, setPersonalDetails] = useState({
    fullName: '',
    panNumber: '',
    mobile: '',
    email: '',
    state: '',
    city: '',
    pincode: '',
    agreeTerms: true
  });

  // Track field interactions for non-aggressive error messages
  const [touched, setTouched] = useState({
    fullName: false,
    panNumber: false,
    mobile: false,
    email: false,
    state: false,
    city: false
  });

  // Aadhaar e-KYC Form State (Server-backed)
  const [aadhaarData, setAadhaarData] = useState({
    aadhaarNumber: '',
    dob: '',
    gender: 'male',
    // Front side
    frontImage: null,
    frontImagePreview: null,
    frontImageName: '',
    frontValidated: false,
    frontValidating: false,
    frontConfidence: 0,
    frontError: '',
    // Back side
    backImage: null,
    backImagePreview: null,
    backImageName: '',
    backValidated: false,
    backValidating: false,
    backConfidence: 0,
    backError: '',
    // OTP & Verification State
    otp: ['', '', '', '', '', ''],
    transactionId: '',
    maskedMobile: '',
    demoOtpHint: '',
    otpSent: false,
    otpVerified: false,
    verifiedName: '',
    verifiedDob: '',
    maskedAadhaar: '',
    verificationToken: '',
    verifiedAt: ''
  });

  const [otpTimer, setOtpTimer] = useState(30);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [aadhaarInitiateError, setAadhaarInitiateError] = useState('');
  const [aadhaarTouched, setAadhaarTouched] = useState({
    aadhaarNumber: false,
    dob: false,
    frontImage: false,
    backImage: false
  });
  const otpInputRefs = useRef([]);

  // Extract surname & name initials for Indian Income Tax PAN verification
  const getExpectedPanInitials = (name) => {
    if (!name) return [];
    const clean = name.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return [];
    
    const initials = [];
    // 1. Surname / Last word initial (Standard per Income Tax Department rules)
    const lastName = parts[parts.length - 1];
    if (lastName && lastName[0]) initials.push(lastName[0]);
    
    // 2. First name initial (for single name or first-name registration)
    const firstName = parts[0];
    if (firstName && firstName[0] && !initials.includes(firstName[0])) {
      initials.push(firstName[0]);
    }
    return initials;
  };

  const panUpper = (personalDetails.panNumber || '').trim().toUpperCase();
  const pan5thChar = panUpper.length >= 5 ? panUpper[4] : '';
  const expectedInitials = getExpectedPanInitials(personalDetails.fullName);

  // Full Name validation: minimum 3 letters, alphabets/spaces only, must contain vowels
  const isNameValid = (() => {
    const trimmed = (personalDetails.fullName || '').trim();
    if (trimmed.length < 3 || trimmed.length > 70) return false;
    if (!/^[a-zA-Z\s.]{3,70}$/.test(trimmed)) return false;
    if (!/[aeiouAEIOU]/.test(trimmed)) return false;
    return true;
  })();

  // Indian PAN format: 5 uppercase letters (4th char is status: P, C, H, F, A, T, B, L, J, G), 4 digits, 1 letter
  const isPanFormatValid = /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/.test(panUpper);

  // Cross-verification: PAN 5th character must match the applicant's surname/name initial
  const isPanNameMatched = isPanFormatValid && isNameValid && expectedInitials.length > 0 && expectedInitials.includes(pan5thChar);
  const isPanValid = isPanFormatValid;

  const isMobileValid = /^[6-9]\d{9}$/.test((personalDetails.mobile || '').trim());
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((personalDetails.email || '').trim());
  const isStateValid = Boolean(personalDetails.state);
  const isCityValid = Boolean(personalDetails.city);
  const isStep5Valid = isPanFormatValid && isNameValid && isPanNameMatched && isMobileValid && isEmailValid && isStateValid && isCityValid && personalDetails.agreeTerms;

  // Aadhaar Validations (Format vs Server Verified)
  const cleanAadhaar = (aadhaarData.aadhaarNumber || '').replace(/\s/g, '');
  const isAadhaarFormatValid = /^[2-9]{1}[0-9]{11}$/.test(cleanAadhaar);
  const isDobSelected = Boolean(aadhaarData.dob);
  const isFrontImageValidated = Boolean(aadhaarData.frontValidated && (aadhaarData.frontImage || aadhaarData.frontImagePreview));
  const isBackImageValidated = Boolean(aadhaarData.backValidated && (aadhaarData.backImage || aadhaarData.backImagePreview));
  const isAadhaarDocsReady = isAadhaarFormatValid && isDobSelected && isFrontImageValidated && isBackImageValidated;
  const isAadhaarFullyVerified = aadhaarData.otpVerified && Boolean(aadhaarData.verificationToken);

  // OTP Countdown Timer
  useEffect(() => {
    let interval = null;
    if (aadhaarStage === 'otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [aadhaarStage, otpTimer]);

  const handleAmountSelect = (val) => {
    setAmount(val);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (e) => {
    const val = Number(e.target.value);
    setCustomAmount(e.target.value);
    if (val > 0) {
      setAmount(val);
    }
  };

  // Aadhaar Number Input with Auto Spaces (XXXX XXXX XXXX)
  const handleAadhaarNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setAadhaarData((prev) => ({ ...prev, aadhaarNumber: formatted }));
  };

  // Server-side Document Security & Classification Handler
  const handleAadhaarFileUpload = async (side, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      const errMsg = 'Unsupported file format. Please upload JPG, PNG, WEBP, or PDF.';
      if (side === 'front') {
        setAadhaarData((prev) => ({ ...prev, frontError: errMsg, frontValidated: false }));
      } else {
        setAadhaarData((prev) => ({ ...prev, backError: errMsg, backValidated: false }));
      }
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      const errMsg = 'File exceeds maximum size of 6MB. Please upload a smaller image.';
      if (side === 'front') {
        setAadhaarData((prev) => ({ ...prev, frontError: errMsg, frontValidated: false }));
      } else {
        setAadhaarData((prev) => ({ ...prev, backError: errMsg, backValidated: false }));
      }
      return;
    }

    // Set validating state
    if (side === 'front') {
      setAadhaarData((prev) => ({
        ...prev,
        frontValidating: true,
        frontError: '',
        frontValidated: false
      }));
    } else {
      setAadhaarData((prev) => ({
        ...prev,
        backValidating: true,
        backError: '',
        backValidated: false
      }));
    }

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const fileDataUrl = uploadEvent.target.result;

      try {
        const res = await apiFetch('/kyc/aadhaar/validate-document', {
          method: 'POST',
          body: {
            side,
            fileBase64: fileDataUrl,
            mimeType: file.type,
            fileName: file.name,
            applicantName: personalDetails.fullName,
            aadhaarNumber: aadhaarData.aadhaarNumber,
            dob: aadhaarData.dob
          }
        });

        if (!res.ok || !res.data?.ok) {
          const errMsg = res.data?.error || `Document validation failed for Aadhaar ${side}.`;
          if (side === 'front') {
            setAadhaarData((prev) => ({
              ...prev,
              frontValidating: false,
              frontValidated: false,
              frontError: errMsg,
              frontImage: null,
              frontImagePreview: null,
              frontImageName: ''
            }));
          } else {
            setAadhaarData((prev) => ({
              ...prev,
              backValidating: false,
              backValidated: false,
              backError: errMsg,
              backImage: null,
              backImagePreview: null,
              backImageName: ''
            }));
          }
          return;
        }

        // Server successfully validated the document!
        if (side === 'front') {
          setAadhaarData((prev) => ({
            ...prev,
            frontImage: file,
            frontImagePreview: fileDataUrl,
            frontImageName: file.name,
            frontValidating: false,
            frontValidated: true,
            frontConfidence: res.data.confidence || 90,
            frontError: ''
          }));
        } else {
          setAadhaarData((prev) => ({
            ...prev,
            backImage: file,
            backImagePreview: fileDataUrl,
            backImageName: file.name,
            backValidating: false,
            backValidated: true,
            backConfidence: res.data.confidence || 90,
            backError: ''
          }));
        }
      } catch (err) {
        const errMsg = 'Network or server error validating document. Please try again.';
        if (side === 'front') {
          setAadhaarData((prev) => ({
            ...prev,
            frontValidating: false,
            frontValidated: false,
            frontError: errMsg
          }));
        } else {
          setAadhaarData((prev) => ({
            ...prev,
            backValidating: false,
            backValidated: false,
            backError: errMsg
          }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAadhaarFile = (side) => {
    if (side === 'front') {
      setAadhaarData((prev) => ({
        ...prev,
        frontImage: null,
        frontImagePreview: null,
        frontImageName: '',
        frontValidated: false,
        frontError: ''
      }));
    } else {
      setAadhaarData((prev) => ({
        ...prev,
        backImage: null,
        backImagePreview: null,
        backImageName: '',
        backValidated: false,
        backError: ''
      }));
    }
  };

  // Trigger Aadhaar OTP to Registered Mobile via Backend KYC API
  const handleSendAadhaarOtp = async () => {
    setAadhaarTouched({
      aadhaarNumber: true,
      dob: true,
      frontImage: true,
      backImage: true
    });
    setAadhaarInitiateError('');

    if (!isAadhaarDocsReady) return;

    setOtpSending(true);
    try {
      const res = await apiFetch('/kyc/aadhaar/initiate', {
        method: 'POST',
        body: {
          aadhaarNumber: cleanAadhaar,
          applicantName: personalDetails.fullName,
          dob: aadhaarData.dob,
          panNumber: personalDetails.panNumber
        }
      });

      setOtpSending(false);

      if (!res.ok || !res.data?.ok) {
        setAadhaarInitiateError(res.data?.error || 'Unable to initiate Aadhaar OTP verification.');
        return;
      }

      setAadhaarData((prev) => ({
        ...prev,
        transactionId: res.data.transactionId,
        maskedMobile: res.data.maskedMobile || `+91 ******${cleanAadhaar.slice(-4)}`,
        demoOtpHint: res.data.demoOtpHint || '',
        otp: ['', '', '', '', '', ''],
        otpSent: true
      }));
      setOtpTimer(30);
      setOtpError('');
      setAadhaarStage('otp');
    } catch (err) {
      setOtpSending(false);
      setAadhaarInitiateError('Server connection error. Please check your network and try again.');
    }
  };

  // 6-digit OTP Inputs Handler
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newOtpArr = [...aadhaarData.otp];
    newOtpArr[index] = cleanVal;
    setAadhaarData((prev) => ({ ...prev, otp: newOtpArr }));
    setOtpError('');

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !aadhaarData.otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newArr = [...aadhaarData.otp];
    for (let i = 0; i < 6; i++) {
      newArr[i] = pasted[i] || '';
    }
    setAadhaarData((prev) => ({ ...prev, otp: newArr }));
    setOtpError('');
    const nextFocus = Math.min(pasted.length, 5);
    otpInputRefs.current[nextFocus]?.focus();
  };

  // Verify Aadhaar OTP via Backend KYC API
  const handleVerifyAadhaarOtp = async () => {
    const enteredOtp = aadhaarData.otp.join('');
    if (enteredOtp.length < 6) {
      setOtpError('Please enter all 6 digits of the OTP.');
      return;
    }

    setOtpVerifying(true);
    setOtpError('');

    try {
      const res = await apiFetch('/kyc/aadhaar/verify-otp', {
        method: 'POST',
        body: {
          transactionId: aadhaarData.transactionId,
          otp: enteredOtp,
          applicantName: personalDetails.fullName,
          dob: aadhaarData.dob
        }
      });

      setOtpVerifying(false);

      if (!res.ok || !res.data?.verified) {
        setOtpError(res.data?.error || 'Aadhaar OTP verification failed. Please check the OTP and try again.');
        return;
      }

      // Server verified successfully!
      setAadhaarData((prev) => ({
        ...prev,
        otpVerified: true,
        maskedAadhaar: res.data.maskedAadhaar,
        verifiedName: res.data.verifiedName,
        verifiedDob: res.data.verifiedDob,
        verificationToken: res.data.verificationToken,
        verifiedAt: res.data.verifiedAt
      }));
      setAadhaarStage('verified');
    } catch (err) {
      setOtpVerifying(false);
      setOtpError('Server verification error. Please try again.');
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Step 5
      if (aadhaarStage === 'details') {
        setTouched({
          fullName: true,
          panNumber: true,
          mobile: true,
          email: true,
          state: true,
          city: true
        });

        if (!isStep5Valid) {
          return;
        }

        // Proceed to Aadhaar Documents stage
        setAadhaarStage('aadhaar_docs');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (aadhaarStage === 'verified') {
        if (!isAadhaarFullyVerified) {
          return;
        }

        // Step 5 Completed -> Trigger engine evaluation
        setLoadingResults(true);
        setTimeout(() => {
          setLoadingResults(false);
          setStep(6); // Step 6 = Results View
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 1600);
      }
    }
  };

  const handleBack = () => {
    if (step === 5) {
      if (aadhaarStage === 'verified') {
        setAadhaarStage('otp');
      } else if (aadhaarStage === 'otp') {
        setAadhaarStage('aadhaar_docs');
      } else if (aadhaarStage === 'aadhaar_docs') {
        setAadhaarStage('details');
      } else {
        setStep(4);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/credit');
    }
  };

  const handleSelectLoanOption = (option) => {
    // Save selection in session/localStorage for the application step
    const applicationDraft = {
      loanAmount: amount,
      purpose,
      employmentType,
      monthlyIncome,
      personalDetails,
      aadhaarData: {
        aadhaarNumber: aadhaarData.aadhaarNumber,
        dob: aadhaarData.dob,
        gender: aadhaarData.gender,
        frontImageName: aadhaarData.frontImageName,
        backImageName: aadhaarData.backImageName,
        otpVerified: aadhaarData.otpVerified
      },
      selectedOption: option,
      createdAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('kepwe_credit_draft', JSON.stringify(applicationDraft));
    } catch (e) {
      console.warn('Storage failed', e);
    }
    navigate('/credit/apply');
  };

  return (
    <div className="credit-eligibility-wrapper">
      
      {/* ── Sub Navigation Header ── */}
      <div className="eligibility-subnav">
        <div className="container subnav-container">
          <Link to="/credit" className="subnav-back-link">
            <ArrowLeft size={16} />
            <span>Back to Kepwe Credit</span>
          </Link>
          <div className="subnav-brand">
            <span className="brand-dot" />
            <span>Kepwe Credit Eligibility Journey</span>
          </div>
          <div className="subnav-trust-badge">
            <Lock size={13} color="#214ECF" />
            <span>Soft Check · No Impact on Score</span>
          </div>
        </div>
      </div>

      <div className="container eligibility-main-content">

        {/* ── Multi-Step Progress Indicator ── */}
        {step <= 5 && (
          <div className="wizard-progress-section">
            <div className="wizard-progress-card">
              <div className="wizard-steps-track-wrapper">
                {/* Connected progress line track */}
                <div className="wizard-steps-connector-track">
                  <div className="wizard-steps-connector-bg" />
                  <div 
                    className="wizard-steps-connector-fill" 
                    style={{ width: `${((step - 1) / 4) * 100}%` }} 
                  />
                </div>
                
                <div className="wizard-steps-nodes">
                  {STEPS_NAV.map((s) => {
                    const isCompleted = step > s.id;
                    const isCurrent = step === s.id;
                    const isUpcoming = step < s.id;

                    return (
                      <div 
                        key={s.id} 
                        className={`wizard-step-node ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-completed' : ''} ${isUpcoming ? 'is-upcoming' : ''}`}
                      >
                        <div className="step-node-circle">
                          {isCompleted ? (
                            <Check size={14} strokeWidth={3} />
                          ) : (
                            <span>{s.id}</span>
                          )}
                        </div>
                        <span className="step-node-label">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="progress-status-strip">
                <span className="progress-status-current">
                  Step {step} of 5: <strong>{STEPS_NAV[step - 1]?.label}</strong>
                </span>
                <span className="progress-status-percent">
                  {step * 20}% Completed
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: LOAN AMOUNT ── */}
        {step === 1 && (
          <div className="wizard-step-card animate-fadeIn">
            <div className="step-header">
              <div className="step-badge">01 · REQUIREMENT</div>
              <h1 className="step-headline">How much are you looking for?</h1>
              <p className="step-subhead">
                Select your approximate loan requirement. You can fine-tune this later with your matched lenders.
              </p>
            </div>

            <div className="amount-pills-grid">
              {LOAN_AMOUNTS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleAmountSelect(item.value)}
                  className={`amount-pill-btn ${amount === item.value && !customAmount ? 'active' : ''}`}
                >
                  <span className="pill-val">{item.label}</span>
                  {item.recommended && <span className="pill-tag">Most Popular</span>}
                </button>
              ))}
            </div>

            <div className="custom-amount-box">
              <label className="custom-input-label">Or enter a custom amount (₹):</label>
              <div className="custom-input-wrap">
                <span className="currency-symbol">₹</span>
                <input
                  type="number"
                  placeholder="3,50,000"
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                  className="custom-amount-input"
                  min="25000"
                  max="5000000"
                />
              </div>
            </div>

            <div className="selected-amount-display">
              <span className="sel-label">Selected Requirement:</span>
              <span className="sel-value">₹{amount.toLocaleString('en-IN')}</span>
            </div>

            <div className="wizard-actions">
              <button type="button" onClick={handleBack} className="btn-wizard-back">
                Cancel
              </button>
              <button type="button" onClick={handleNext} className="btn-wizard-primary">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: LOAN PURPOSE ── */}
        {step === 2 && (
          <div className="wizard-step-card animate-fadeIn">
            <div className="step-header">
              <div className="step-badge">02 · PURPOSE</div>
              <h1 className="step-headline">What do you need the loan for?</h1>
              <p className="step-subhead">
                Different purposes may qualify for specific lender categories, interest rates, or structured tenures.
              </p>
            </div>

            <div className="purposes-grid">
              {PURPOSES.map((item) => {
                const Icon = item.icon;
                const isSelected = purpose === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setPurpose(item.id)}
                    className={`purpose-option-card ${isSelected ? 'active' : ''}`}
                  >
                    <div className="p-icon-box">
                      <Icon size={20} />
                    </div>
                    <div className="p-info">
                      <h4 className="p-title">{item.label}</h4>
                      <p className="p-desc">{item.desc}</p>
                    </div>
                    <div className={`p-radio-circle ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="wizard-actions">
              <button type="button" onClick={handleBack} className="btn-wizard-back">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={handleNext} className="btn-wizard-primary">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: EMPLOYMENT PROFILE ── */}
        {step === 3 && (
          <div className="wizard-step-card animate-fadeIn">
            <div className="step-header">
              <div className="step-badge">03 · EMPLOYMENT PROFILE</div>
              <h1 className="step-headline">What's your employment profile?</h1>
              <p className="step-subhead">
                Lenders assess eligibility based on employment stability and income patterns.
              </p>
            </div>

            <div className="employment-grid">
              {EMPLOYMENT_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = employmentType === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setEmploymentType(item.id)}
                    className={`employment-card ${isSelected ? 'active' : ''}`}
                  >
                    <div className="emp-icon-box">
                      <Icon size={22} />
                    </div>
                    <h3 className="emp-title">{item.label}</h3>
                    <p className="emp-desc">{item.desc}</p>
                    <div className={`emp-selector ${isSelected ? 'selected' : ''}`}>
                      {isSelected ? '✓ Selected Profile' : 'Select Profile'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="wizard-actions">
              <button type="button" onClick={handleBack} className="btn-wizard-back">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={handleNext} className="btn-wizard-primary">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: MONTHLY INCOME ── */}
        {step === 4 && (
          <div className="wizard-step-card animate-fadeIn">
            <div className="step-header">
              <div className="step-badge">04 · MONTHLY INCOME</div>
              <h1 className="step-headline">What's your approximate monthly income?</h1>
              <p className="step-subhead">
                Provide your net monthly take-home salary or average monthly business earnings.
              </p>
            </div>

            <div className="income-input-container">
              <label className="income-label">Net Monthly Take-Home (₹)</label>
              <div className="income-field-wrap">
                <span className="income-curr">₹</span>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                  className="income-input-box"
                  placeholder="50,000"
                />
              </div>

              <div className="income-quick-chips">
                <span className="quick-label">Quick select:</span>
                {[35000, 50000, 75000, 100000, 150000].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setMonthlyIncome(inc)}
                    className={`income-chip ${monthlyIncome === inc ? 'active' : ''}`}
                  >
                    ₹{(inc / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>

            <div className="income-helper-note">
              <Info size={16} color="#214ECF" />
              <span>
                Higher net monthly earnings with clean bank records typically unlock better interest rates and larger credit lines.
              </span>
            </div>

            <div className="wizard-actions">
              <button type="button" onClick={handleBack} className="btn-wizard-back">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={handleNext} className="btn-wizard-primary">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: PERSONAL DETAILS & AADHAAR e-KYC ── */}
        {step === 5 && (
          <div className="wizard-step-card animate-fadeIn">

            {/* ── SUB-STAGE 1: PERSONAL & PAN DETAILS ── */}
            {aadhaarStage === 'details' && (
              <div className="aadhaar-substage-wrap animate-fadeIn">
                <div className="step-header">
                  <div className="step-badge">05 · PERSONAL & PAN DETAILS</div>
                  <h1 className="step-headline">Where should we deliver your options?</h1>
                  <p className="step-subhead">
                    Enter your contact & PAN details first. In the next step, we will verify your Aadhaar e-KYC.
                  </p>
                </div>

                <div className="form-fields-grid">
                  {/* 1. Full Name */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Full Name (as per PAN Card) *</label>
                      {touched.fullName && isNameValid && (isPanNameMatched || !panUpper || panUpper.length < 5) && (
                        <span className="field-valid-badge">
                          <Check size={12} strokeWidth={3} /> {isPanNameMatched ? 'Matches PAN' : 'Valid Name'}
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <User 
                        size={17} 
                        strokeWidth={2} 
                        className={`field-icon ${touched.fullName && (!isNameValid || (panUpper.length === 10 && isPanFormatValid && !isPanNameMatched)) ? 'icon-invalid' : ''}`} 
                      />
                      <input
                        type="text"
                        placeholder="Enter PAN name"
                        value={personalDetails.fullName}
                        onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                        onChange={(e) => setPersonalDetails({ ...personalDetails, fullName: e.target.value })}
                        className={`form-input has-icon ${touched.fullName && (!isNameValid || (panUpper.length === 10 && isPanFormatValid && !isPanNameMatched)) ? 'is-invalid' : ''} ${touched.fullName && isNameValid && (isPanNameMatched || !panUpper || panUpper.length < 5) ? 'is-valid' : ''}`}
                        required
                      />
                    </div>
                    {touched.fullName && !isNameValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Please enter a valid name as on PAN card (minimum 3 letters).
                      </span>
                    )}
                    {touched.fullName && isNameValid && panUpper.length === 10 && isPanFormatValid && !isPanNameMatched && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Name mismatch: Surname initial does not match 5th letter of PAN ('{pan5thChar}').
                      </span>
                    )}
                  </div>

                  {/* 2. PAN Card Number */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">PAN Card Number *</label>
                      {touched.panNumber && isPanFormatValid && isPanNameMatched && (
                        <span className="field-valid-badge">
                          <Check size={12} strokeWidth={3} /> Verified PAN
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <CreditCard 
                        size={17} 
                        strokeWidth={2} 
                        className={`field-icon ${touched.panNumber && (!isPanFormatValid || (isNameValid && !isPanNameMatched)) ? 'icon-invalid' : ''}`} 
                      />
                      <input
                        type="text"
                        placeholder="e.g. ABCDE1234F"
                        maxLength={10}
                        style={{ textTransform: 'uppercase' }}
                        value={personalDetails.panNumber}
                        onBlur={() => setTouched((prev) => ({ ...prev, panNumber: true }))}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                          setPersonalDetails({ ...personalDetails, panNumber: val });
                        }}
                        className={`form-input has-icon ${touched.panNumber && (!isPanFormatValid || (isNameValid && !isPanNameMatched)) ? 'is-invalid' : ''} ${touched.panNumber && isPanFormatValid && (!personalDetails.fullName || isPanNameMatched) ? 'is-valid' : ''}`}
                        required
                      />
                    </div>
                    {touched.panNumber && !isPanFormatValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Enter a valid 10-character PAN number (e.g. ABCDE1234F).
                      </span>
                    )}
                    {touched.panNumber && isPanFormatValid && isNameValid && !isPanNameMatched && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> PAN 5th letter '{pan5thChar}' does not match name/surname initial ({expectedInitials.join('/') || '?'}).
                      </span>
                    )}
                  </div>

                  {/* 3. Mobile Number */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Aadhaar-Linked Mobile *</label>
                      {touched.mobile && isMobileValid && (
                        <span className="field-valid-badge">
                          <Check size={12} strokeWidth={3} /> Valid Mobile
                        </span>
                      )}
                    </div>
                    <div className="phone-input-wrap">
                      <div className="phone-prefix-block">
                        <Phone size={17} strokeWidth={2} className="phone-prefix-icon" />
                        <span className="phone-prefix-text">+91</span>
                      </div>
                      <input
                        type="tel"
                        placeholder="933477XXXX"
                        maxLength={10}
                        value={personalDetails.mobile}
                        onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPersonalDetails({ ...personalDetails, mobile: val });
                        }}
                        className={`form-input phone-input ${touched.mobile && !isMobileValid ? 'is-invalid' : ''} ${touched.mobile && isMobileValid ? 'is-valid' : ''}`}
                        required
                      />
                    </div>
                    {touched.mobile && !isMobileValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Enter a valid 10-digit mobile number.
                      </span>
                    )}
                  </div>

                  {/* 4. Email Address */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Email Address *</label>
                      {touched.email && isEmailValid && (
                        <span className="field-valid-badge">
                          <Check size={12} strokeWidth={3} /> Valid Email
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <Mail size={17} strokeWidth={2} className={`field-icon ${touched.email && !isEmailValid ? 'icon-invalid' : ''}`} />
                      <input
                        type="email"
                        placeholder="naviXXXX@gmail.com"
                        value={personalDetails.email}
                        onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                        onChange={(e) => setPersonalDetails({ ...personalDetails, email: e.target.value })}
                        className={`form-input has-icon ${touched.email && !isEmailValid ? 'is-invalid' : ''} ${touched.email && isEmailValid ? 'is-valid' : ''}`}
                        required
                      />
                    </div>
                    {touched.email && !isEmailValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Enter a valid email address.
                      </span>
                    )}
                  </div>

                  {/* 5. State Dropdown */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Select State / UT *</label>
                      {touched.state && isStateValid && (
                        <span className="field-valid-badge">
                          <Check size={12} strokeWidth={3} /> Selected
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <MapPin size={17} strokeWidth={2} className={`field-icon ${touched.state && !isStateValid ? 'icon-invalid' : ''}`} />
                      <select
                        value={personalDetails.state}
                        onBlur={() => setTouched((prev) => ({ ...prev, state: true }))}
                        onChange={(e) => {
                          const selectedSt = e.target.value;
                          setPersonalDetails({
                            ...personalDetails,
                            state: selectedSt,
                            city: ''
                          });
                        }}
                        className={`form-input has-icon ${touched.state && !isStateValid ? 'is-invalid' : ''} ${touched.state && isStateValid ? 'is-valid' : ''}`}
                        required
                      >
                        <option value="">-- Choose State / UT --</option>
                        {Object.keys(INDIAN_STATES_CITIES).map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    {touched.state && !isStateValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Please select your State or Union Territory.
                      </span>
                    )}
                  </div>

                  {/* 6. City Dropdown */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Select City *</label>
                      {touched.city && isCityValid && (
                        <span className="field-valid-badge">
                          <Check size={12} strokeWidth={3} /> Selected
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <Building2 size={17} strokeWidth={2} className={`field-icon ${touched.city && !isCityValid ? 'icon-invalid' : ''}`} />
                      <select
                        value={personalDetails.city}
                        disabled={!personalDetails.state}
                        onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                        onChange={(e) => setPersonalDetails({ ...personalDetails, city: e.target.value })}
                        className={`form-input has-icon ${touched.city && !isCityValid ? 'is-invalid' : ''} ${touched.city && isCityValid ? 'is-valid' : ''}`}
                        required
                      >
                        <option value="">{personalDetails.state ? '-- Choose City --' : '-- Select State First --'}</option>
                        {(INDIAN_STATES_CITIES[personalDetails.state] || []).map((ct) => (
                          <option key={ct} value={ct}>{ct}</option>
                        ))}
                      </select>
                    </div>
                    {touched.city && !isCityValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> {personalDetails.state ? 'Please select your city.' : 'Please select state first.'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="consent-checkbox-wrap">
                  <input
                    type="checkbox"
                    id="credit-consent"
                    checked={personalDetails.agreeTerms}
                    onChange={(e) => setPersonalDetails({ ...personalDetails, agreeTerms: e.target.checked })}
                    className="consent-checkbox"
                  />
                  <label htmlFor="credit-consent" className="consent-label">
                    I authorize Kepwe Credit and its authorized lending partners to retrieve eligibility and contact me regarding credit options. Checking options will perform a soft check and will not harm my credit score.
                  </label>
                </div>

                <div className="wizard-actions">
                  <button type="button" onClick={handleBack} className="btn-wizard-back">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNext} 
                    className="btn-wizard-primary"
                    disabled={!isStep5Valid}
                  >
                    Verify PAN & Proceed to Aadhaar e-KYC <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── SUB-STAGE 2: AADHAAR CARD DETAILS & PHOTO UPLOADS ── */}
            {aadhaarStage === 'aadhaar_docs' && (
              <div className="aadhaar-substage-wrap animate-fadeIn">
                <div className="step-header">
                  <div className="step-badge aadhaar-badge">
                    <Shield size={13} /> UIDAI GOVERNMENT e-KYC VERIFICATION
                  </div>
                  <h1 className="step-headline">Aadhaar Card Details & Document Upload</h1>
                  <p className="step-subhead">
                    Enter your 12-digit Aadhaar number and upload front & back photos for server-side document and identity verification.
                  </p>
                </div>

                {/* Identity Cross Check Pill */}
                <div className="aadhaar-id-summary-strip">
                  <div className="id-item">
                    <span className="id-lbl">Applicant:</span>
                    <span className="id-val">{personalDetails.fullName}</span>
                  </div>
                  <div className="id-divider" />
                  <div className="id-item">
                    <span className="id-lbl">PAN Card:</span>
                    <span className="id-val font-mono">{personalDetails.panNumber}</span>
                  </div>
                  <div className="id-divider" />
                  <div className="id-item">
                    <span className="id-lbl">Contact Mobile:</span>
                    <span className="id-val font-mono">+91 {personalDetails.mobile}</span>
                  </div>
                </div>

                {aadhaarInitiateError && (
                  <div className="kyc-server-error-banner animate-fadeIn">
                    <AlertTriangle size={17} className="banner-icon" />
                    <div className="banner-text">
                      <strong>Verification Failed:</strong> {aadhaarInitiateError}
                    </div>
                  </div>
                )}

                <div className="form-fields-grid" style={{ marginTop: '20px' }}>
                  {/* 1. Aadhaar Card Number */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">12-Digit Aadhaar Card Number *</label>
                      {isAadhaarFormatValid && (
                        <span className="field-pending-badge">
                          Format valid · Pending Verification
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <Fingerprint size={18} strokeWidth={2} className={`field-icon ${aadhaarTouched.aadhaarNumber && !isAadhaarFormatValid ? 'icon-invalid' : ''}`} />
                      <input
                        type="text"
                        placeholder="XXXX XXXX XXXX"
                        maxLength={14}
                        value={aadhaarData.aadhaarNumber}
                        onBlur={() => setAadhaarTouched((prev) => ({ ...prev, aadhaarNumber: true }))}
                        onChange={handleAadhaarNumberChange}
                        className={`form-input has-icon font-mono ${aadhaarTouched.aadhaarNumber && !isAadhaarFormatValid ? 'is-invalid' : ''}`}
                        required
                      />
                    </div>
                    {aadhaarTouched.aadhaarNumber && !isAadhaarFormatValid && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Enter a valid 12-digit Aadhaar number (e.g. 5432 1234 5678).
                      </span>
                    )}
                  </div>

                  {/* 2. Date of Birth */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">Date of Birth (as on Aadhaar) *</label>
                      {aadhaarData.dob && (
                        <span className="field-pending-badge">
                          Verification Pending
                        </span>
                      )}
                    </div>
                    <div className="input-icon-wrap">
                      <Calendar size={17} strokeWidth={2} className="field-icon" />
                      <input
                        type="date"
                        value={aadhaarData.dob}
                        max={new Date().toISOString().split('T')[0]}
                        onBlur={() => setAadhaarTouched((prev) => ({ ...prev, dob: true }))}
                        onChange={(e) => setAadhaarData({ ...aadhaarData, dob: e.target.value })}
                        className={`form-input has-icon ${aadhaarTouched.dob && !aadhaarData.dob ? 'is-invalid' : ''}`}
                        required
                      />
                    </div>
                    {aadhaarTouched.dob && !aadhaarData.dob && (
                      <span className="field-error-msg">
                        <AlertCircle size={13} /> Select your date of birth as on your Aadhaar card.
                      </span>
                    )}
                  </div>
                </div>

                {/* Document Upload Section (Front + Back Mandatory) */}
                <div className="aadhaar-upload-section">
                  <div className="upload-sec-header">
                    <h3 className="upload-sec-title">Upload Aadhaar Card Photos (Front & Back) *</h3>
                    <span className="upload-sec-hint">Both sides are verified by server-side document inspection before OTP dispatch</span>
                  </div>

                  <div className="aadhaar-upload-grid">
                    {/* Front Upload */}
                    <div className={`aadhaar-upload-card ${aadhaarData.frontValidated ? 'is-uploaded' : ''} ${aadhaarData.frontError ? 'is-error' : ''}`}>
                      <div className="card-side-badge">SIDE 1 · FRONT</div>
                      
                      {aadhaarData.frontValidating ? (
                        <div className="upload-scanning-box">
                          <RefreshCw size={24} className="spin text-blue" />
                          <span className="scanning-text">Analyzing Document Authenticity...</span>
                          <span className="scanning-sub">Checking UIDAI security signals & format</span>
                        </div>
                      ) : aadhaarData.frontValidated ? (
                        <div className="upload-preview-content">
                          <div className="preview-img-box">
                            <img src={aadhaarData.frontImagePreview} alt="Aadhaar Front" className="preview-img" />
                          </div>
                          <div className="preview-meta">
                            <span className="preview-file-name">{aadhaarData.frontImageName || 'aadhaar_front.jpg'}</span>
                            <span className="preview-status-pill verified">
                              <Check size={12} strokeWidth={3} /> ✓ Aadhaar Front Verified
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveAadhaarFile('front')}
                            className="btn-remove-upload"
                          >
                            <Trash2 size={14} /> Remove / Re-upload
                          </button>
                        </div>
                      ) : (
                        <div className="upload-dropzone-wrap">
                          <label className="upload-dropzone-label">
                            <input 
                              type="file" 
                              accept="image/*,application/pdf" 
                              onChange={(e) => handleAadhaarFileUpload('front', e)}
                              className="file-hidden-input"
                            />
                            <div className="dropzone-icon-circle">
                              <UploadCloud size={24} color="#214ECF" />
                            </div>
                            <span className="dropzone-title">Upload Aadhaar Front</span>
                            <span className="dropzone-desc">Photo side with Name & 12-digit number</span>
                            <span className="dropzone-btn-fake">Browse Photo</span>
                          </label>
                          {aadhaarData.frontError && (
                            <div className="doc-inline-error">
                              <AlertTriangle size={14} className="error-icon" />
                              <span>{aadhaarData.frontError}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Back Upload */}
                    <div className={`aadhaar-upload-card ${aadhaarData.backValidated ? 'is-uploaded' : ''} ${aadhaarData.backError ? 'is-error' : ''}`}>
                      <div className="card-side-badge">SIDE 2 · BACK</div>
                      
                      {aadhaarData.backValidating ? (
                        <div className="upload-scanning-box">
                          <RefreshCw size={24} className="spin text-blue" />
                          <span className="scanning-text">Analyzing Document Authenticity...</span>
                          <span className="scanning-sub">Checking Address signals & QR barcode</span>
                        </div>
                      ) : aadhaarData.backValidated ? (
                        <div className="upload-preview-content">
                          <div className="preview-img-box">
                            <img src={aadhaarData.backImagePreview} alt="Aadhaar Back" className="preview-img" />
                          </div>
                          <div className="preview-meta">
                            <span className="preview-file-name">{aadhaarData.backImageName || 'aadhaar_back.jpg'}</span>
                            <span className="preview-status-pill verified">
                              <Check size={12} strokeWidth={3} /> ✓ Aadhaar Back Verified
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveAadhaarFile('back')}
                            className="btn-remove-upload"
                          >
                            <Trash2 size={14} /> Remove / Re-upload
                          </button>
                        </div>
                      ) : (
                        <div className="upload-dropzone-wrap">
                          <label className="upload-dropzone-label">
                            <input 
                              type="file" 
                              accept="image/*,application/pdf" 
                              onChange={(e) => handleAadhaarFileUpload('back', e)}
                              className="file-hidden-input"
                            />
                            <div className="dropzone-icon-circle">
                              <UploadCloud size={24} color="#214ECF" />
                            </div>
                            <span className="dropzone-title">Upload Aadhaar Back</span>
                            <span className="dropzone-desc">Address side with QR Code</span>
                            <span className="dropzone-btn-fake">Browse Photo</span>
                          </label>
                          {aadhaarData.backError && (
                            <div className="doc-inline-error">
                              <AlertTriangle size={14} className="error-icon" />
                              <span>{aadhaarData.backError}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {(!isFrontImageValidated || !isBackImageValidated) && (
                    <div className="upload-requirement-note">
                      <Info size={15} />
                      <span>Both Front and Back photos must pass server document validation before OTP can be dispatched.</span>
                    </div>
                  )}
                </div>

                <div className="wizard-actions">
                  <button type="button" onClick={() => setAadhaarStage('details')} className="btn-wizard-back">
                    <ArrowLeft size={16} /> Edit Personal Details
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSendAadhaarOtp} 
                    className="btn-wizard-primary"
                    disabled={!isAadhaarDocsReady || otpSending}
                  >
                    {otpSending ? 'Initiating UIDAI OTP...' : 'Send Aadhaar OTP to Registered Mobile'} <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── SUB-STAGE 3: AADHAAR LINKED MOBILE OTP VERIFICATION ── */}
            {aadhaarStage === 'otp' && (
              <div className="aadhaar-substage-wrap animate-fadeIn">
                <div className="step-header">
                  <div className="step-badge otp-badge">
                    <KeyRound size={13} /> 05.C · OTP VERIFICATION
                  </div>
                  <h1 className="step-headline">Enter 6-Digit Aadhaar OTP</h1>
                  <p className="step-subhead">
                    A 6-digit verification code has been dispatched through UIDAI to your Aadhaar-registered mobile <strong>{aadhaarData.maskedMobile || ('+91 ******' + cleanAadhaar.slice(-4))}</strong>.
                  </p>
                </div>

                {/* Demo OTP Helper Toast (Sandbox / Dev Environment) */}
                {aadhaarData.demoOtpHint && (
                  <div className="demo-otp-helper-box">
                    <div className="otp-helper-head">
                      <Sparkles size={16} color="#214ECF" />
                      <span>SANDBOX / SIMULATION TEST OTP</span>
                    </div>
                    <div className="otp-code-highlight">
                      <span>Test OTP: <strong>{aadhaarData.demoOtpHint}</strong></span>
                      <button 
                        type="button" 
                        onClick={() => {
                          const digits = aadhaarData.demoOtpHint.split('');
                          setAadhaarData((prev) => ({ ...prev, otp: digits }));
                        }}
                        className="btn-auto-fill-otp"
                      >
                        Auto-Fill OTP
                      </button>
                    </div>
                  </div>
                )}

                {/* 6 OTP Input Boxes */}
                <div className="otp-boxes-container">
                  <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '14px' }}>
                    Enter 6-Digit Verification Code *
                  </label>
                  <div className="otp-inputs-row" onPaste={handleOtpPaste}>
                    {aadhaarData.otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className={`otp-digit-box ${digit ? 'is-filled' : ''} ${otpError ? 'is-error' : ''}`}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  {otpError && (
                    <div className="otp-error-banner">
                      <AlertCircle size={14} />
                      <span>{otpError}</span>
                    </div>
                  )}

                  {/* Resend OTP Timer */}
                  <div className="otp-resend-row">
                    {otpTimer > 0 ? (
                      <span className="otp-timer-text">Resend OTP in <strong>{otpTimer}s</strong></span>
                    ) : (
                      <button 
                        type="button" 
                        onClick={handleSendAadhaarOtp}
                        className="btn-resend-otp"
                      >
                        <RefreshCw size={13} /> Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                <div className="wizard-actions">
                  <button type="button" onClick={() => setAadhaarStage('aadhaar_docs')} className="btn-wizard-back">
                    <ArrowLeft size={16} /> Back to Aadhaar Details
                  </button>
                  <button 
                    type="button" 
                    onClick={handleVerifyAadhaarOtp} 
                    className="btn-wizard-primary"
                    disabled={aadhaarData.otp.join('').length < 6 || otpVerifying}
                  >
                    {otpVerifying ? 'Verifying with Provider...' : 'Verify OTP & Complete KYC'} <Check size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── SUB-STAGE 4: e-KYC VERIFIED & UNLOCKED CONTINUE ── */}
            {aadhaarStage === 'verified' && (
              <div className="aadhaar-substage-wrap animate-fadeIn">
                
                <div className="kyc-success-banner-card">
                  <div className="kyc-success-icon-wrap">
                    <ShieldCheck size={42} strokeWidth={2.2} color="#10B981" />
                  </div>
                  <div className="kyc-success-badge">UIDAI GOVERNMENT e-KYC VERIFIED</div>
                  <h2 className="kyc-success-title">Identity & Aadhaar Verification Successful!</h2>
                  <p className="kyc-success-desc">
                    Your PAN and Aadhaar identity credentials and uploaded documents have been server-verified with authorized paperless e-KYC.
                  </p>

                  <div className="kyc-verified-details-grid">
                    <div className="v-card">
                      <span className="v-lbl">Verified Name</span>
                      <span className="v-val">{aadhaarData.verifiedName || personalDetails.fullName}</span>
                    </div>
                    <div className="v-card">
                      <span className="v-lbl">PAN Card Number</span>
                      <span className="v-val font-mono">{personalDetails.panNumber}</span>
                    </div>
                    <div className="v-card">
                      <span className="v-lbl">Masked Aadhaar</span>
                      <span className="v-val font-mono">{aadhaarData.maskedAadhaar || `XXXX XXXX ${cleanAadhaar.slice(-4)}`}</span>
                    </div>
                    <div className="v-card">
                      <span className="v-lbl">Verified Date of Birth</span>
                      <span className="v-val font-mono">{aadhaarData.verifiedDob || aadhaarData.dob}</span>
                    </div>
                    <div className="v-card">
                      <span className="v-lbl">Document Uploads</span>
                      <span className="v-val text-green">✓ Front & Back Documents Verified</span>
                    </div>
                    <div className="v-card">
                      <span className="v-lbl">Authentication Mode</span>
                      <span className="v-val text-green">✓ Server-Verified OTP Token</span>
                    </div>
                  </div>
                </div>

                <div className="wizard-actions">
                  <button type="button" onClick={() => setAadhaarStage('details')} className="btn-wizard-back">
                    <ArrowLeft size={16} /> Edit Details
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNext} 
                    className="btn-wizard-primary btn-unlock-continue"
                  >
                    Check My Options <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── LOADING ENGINE STATE ── */}
        {loadingResults && (
          <div className="results-loading-card animate-fadeIn">
            <div className="loading-spinner-ring" />
            <h2 className="loading-title">We're checking your options...</h2>
            <p className="loading-desc">
              Matching your requirement of <strong>₹{amount.toLocaleString('en-IN')}</strong> across partner lending institutions.
            </p>
            <div className="loading-checklist">
              <div className="chk-item active">
                <CheckCircle2 size={16} color="#12B76A" /> Income & Debt Ratio evaluation
              </div>
              <div className="chk-item active">
                <CheckCircle2 size={16} color="#12B76A" /> Partner eligibility criteria check
              </div>
              <div className="chk-item pulsing">
                <Sparkles size={16} color="#214ECF" /> Curating lowest interest rate offers...
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 6: RESULTS COMPARISON STAGE ── */}
        {step === 6 && !loadingResults && (
          <div className="results-page-card animate-fadeIn">
            
            <div className="results-hero-head">
              <div className="r-badge">
                <CheckCircle2 size={15} color="#12B76A" />
                <span>PRE-QUALIFIED OPTIONS FOUND</span>
              </div>
              <h1 className="results-headline">Your Available Credit Options</h1>
              <p className="results-sub">
                Based on your requirement of <strong>₹{amount.toLocaleString('en-IN')}</strong> and monthly profile, here are tailored options from verified lending partners.
              </p>
            </div>

            {/* User Profile Summary Strip */}
            <div className="profile-summary-strip">
              <div className="p-sum-item">
                <span className="lbl">Requested Amount</span>
                <div className="val money-display">
                  <span className="money-curr">₹</span>
                  <span className="money-val">{amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="p-sum-item">
                <span className="lbl">Purpose</span>
                <span className="val" style={{ textTransform: 'capitalize' }}>{purpose}</span>
              </div>
              <div className="p-sum-item">
                <span className="lbl">Profile</span>
                <span className="val" style={{ textTransform: 'capitalize' }}>{employmentType}</span>
              </div>
              <div className="p-sum-item">
                <span className="lbl">Monthly Income</span>
                <div className="val money-display">
                  <span className="money-curr">₹</span>
                  <span className="money-val">{monthlyIncome.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setStep(1);
                  navigate('/credit/eligibility');
                }} 
                className="btn-edit-profile"
              >
                Modify
              </button>
            </div>

            {/* Results Cards List */}
            <div className="options-cards-grid">
              {SAMPLE_LOAN_OPTIONS.map((opt) => (
                <div key={opt.id} className="loan-product-card">
                  <div className="card-top-content">
                    <div className="card-top-header">
                      <span className={`offer-tag ${opt.tagType}`}>{opt.tag}</span>
                      <div className="disbursal-badge">
                        <span>{opt.disbursalTime}</span>
                      </div>
                    </div>

                    <div className="card-lender-info">
                      <h3 className="opt-lender-name">{opt.lenderName}</h3>
                      <span className="opt-plan-name">{opt.planName}</span>
                    </div>

                    <div className="card-metrics-grid">
                      <div className="metric-box">
                        <span className="m-lbl">Eligible Amount</span>
                        <div className="m-val money-display">
                          <span className="money-curr">₹</span>
                          <span className="money-val">{amount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="metric-box">
                        <span className="m-lbl">Tenure</span>
                        <div className="m-val money-display">
                          <span className="money-val">{opt.tenure}</span>
                          <span className="money-unit">Months</span>
                        </div>
                      </div>
                      <div className="metric-box">
                        <span className="m-lbl">Interest Rate</span>
                        <div className="m-val text-blue money-display">
                          <span className="money-val">{opt.interestRate}%</span>
                          <span className="money-unit">p.a.</span>
                        </div>
                      </div>
                      <div className="metric-box highlight">
                        <span className="m-lbl">Estimated EMI</span>
                        <div className="m-val text-blue money-display">
                          <span className="money-curr">₹</span>
                          <span className="money-val">{opt.emi.toLocaleString('en-IN')}</span>
                          <span className="money-unit">/mo</span>
                        </div>
                      </div>
                    </div>

                    <div className="card-features-list">
                      {opt.features.map((feat, idx) => (
                        <div key={idx} className="feat-line">
                          <span className="feat-icon-wrap">
                            <Check size={13} strokeWidth={2.5} className="feat-check-icon" />
                          </span>
                          <span className="feat-text">{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="card-fees-strip">
                      <div className="fee-col">
                        <span className="fee-col-lbl">Processing Fee:</span>
                        <span className="fee-col-val">{opt.processingFee}</span>
                      </div>
                      <div className="fee-divider" />
                      <div className="fee-col">
                        <span className="fee-col-lbl">Prepayment:</span>
                        <span className="fee-col-val">{opt.prepaymentTerms}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions-row">
                    <button
                      type="button"
                      onClick={() => setSelectedOptionModal(opt)}
                      className="btn-view-details"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLoanOption(opt)}
                      className="btn-continue-apply"
                    >
                      <span>Continue Application</span>
                      <ArrowRight size={15} className="btn-arrow-icon" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison Table Section */}
            <div className="comparison-table-wrap">
              <h3 className="comp-title">Compare Key Terms & Transparency Metrics</h3>
              <div className="table-responsive">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Lender / Product</th>
                      <th>Interest (p.a.)</th>
                      <th>Indicative APR</th>
                      <th>Processing Fee</th>
                      <th>Tenure</th>
                      <th>Monthly EMI</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_LOAN_OPTIONS.map((opt) => (
                      <tr key={opt.id}>
                        <td>
                          <strong>{opt.lenderName}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#667085' }}>{opt.planName}</div>
                        </td>
                        <td><span className="text-blue font-bold">{opt.interestRate}%</span></td>
                        <td>{opt.apr}</td>
                        <td>{opt.processingFee}</td>
                        <td>{opt.tenure} mo</td>
                        <td>
                          <span className="money-display font-bold">
                            <span className="money-curr">₹</span>
                            <span className="money-val">{opt.emi.toLocaleString('en-IN')}</span>
                          </span>
                        </td>
                        <td>
                          <button 
                            type="button"
                            onClick={() => handleSelectLoanOption(opt)}
                            className="btn-table-apply"
                          >
                            Apply →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-disclaimer">
                *Rates, EMI, and applicable fees shown are indicative estimates based on provided details. Final terms are governed by the respective lender policies.
              </p>
            </div>

          </div>
        )}

      </div>

      {/* ── OPTION DETAILS MODAL ── */}
      {selectedOptionModal && (
        <div className="modal-backdrop animate-fadeIn" onClick={() => setSelectedOptionModal(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedOptionModal.lenderName}</h3>
                <span className="modal-subtitle">{selectedOptionModal.planName}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedOptionModal(null)} 
                className="btn-close-modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-summary-grid">
                <div className="m-box">
                  <span className="lbl">Loan Amount</span>
                  <div className="val money-display">
                    <span className="money-curr">₹</span>
                    <span className="money-val">{amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="m-box">
                  <span className="lbl">Tenure</span>
                  <div className="val money-display">
                    <span className="money-val">{selectedOptionModal.tenure}</span>
                    <span className="money-unit">Months</span>
                  </div>
                </div>
                <div className="m-box">
                  <span className="lbl">Interest Rate</span>
                  <div className="val text-blue money-display">
                    <span className="money-val">{selectedOptionModal.interestRate}%</span>
                    <span className="money-unit">p.a.</span>
                  </div>
                </div>
                <div className="m-box">
                  <span className="lbl">Estimated EMI</span>
                  <div className="val text-blue money-display">
                    <span className="money-curr">₹</span>
                    <span className="money-val">{selectedOptionModal.emi.toLocaleString('en-IN')}</span>
                    <span className="money-unit">/mo</span>
                  </div>
                </div>
              </div>

              <div className="modal-details-section">
                <h4 className="sec-heading">Fees & Charges</h4>
                <ul className="details-list">
                  <li><strong>Processing Fee:</strong> {selectedOptionModal.processingFee}</li>
                  <li><strong>Indicative APR:</strong> {selectedOptionModal.apr}</li>
                  <li><strong>Prepayment / Foreclosure:</strong> {selectedOptionModal.prepaymentTerms}</li>
                  <li><strong>Documentation Charges:</strong> Nil / 100% Paperless</li>
                </ul>
              </div>

              <div className="modal-details-section">
                <h4 className="sec-heading">Required Documents for Application</h4>
                <ul className="details-list">
                  <li>PAN Card (Identity Verification)</li>
                  <li>Aadhaar Card (Address & KYC Verification via OTP)</li>
                  <li>Latest 3 Months Salary Slips / Bank Statement (Net Banking or PDF)</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setSelectedOptionModal(null)} 
                className="btn-modal-cancel"
              >
                Close
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setSelectedOptionModal(null);
                  handleSelectLoanOption(selectedOptionModal);
                }} 
                className="btn-modal-apply"
              >
                Proceed with this Option <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CreditEligibilityPage;
