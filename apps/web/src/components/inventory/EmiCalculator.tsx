import React, { useState, useMemo } from 'react';
import { Calculator, ShieldCheck } from 'lucide-react';

interface EmiCalculatorProps {
  initialPrice?: number;
  className?: string;
}

export const EmiCalculator: React.FC<EmiCalculatorProps> = ({ initialPrice = 15000000, className = '' }) => {
  // Default loan amount: 80% of property cost
  const [loanAmount, setLoanAmount] = useState<number>(Math.round(initialPrice * 0.8));
  const [interestRate, setInterestRate] = useState<number>(8.5);
  const [tenureYears, setTenureYears] = useState<number>(20);

  const { monthlyEmi, totalInterest, totalPayment, principalRatio, interestRatio } = useMemo(() => {
    const P = loanAmount;
    const r = interestRate / 12 / 100; // Monthly interest rate
    const n = tenureYears * 12; // Total months

    if (P <= 0 || r <= 0 || n <= 0) {
      return { monthlyEmi: 0, totalInterest: 0, totalPayment: 0, principalRatio: 50, interestRatio: 50 };
    }

    const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    const totalPay = emi * n;
    const interest = totalPay - P;

    const pRatio = Math.round((P / totalPay) * 100);
    const iRatio = 100 - pRatio;

    return {
      monthlyEmi: emi,
      totalInterest: interest,
      totalPayment: totalPay,
      principalRatio: pRatio,
      interestRatio: iRatio,
    };
  }, [loanAmount, interestRate, tenureYears]);

  const formatLakhCr = (amt: number) => {
    if (amt >= 10000000) {
      return `₹${(amt / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(amt / 100000).toFixed(1)} L`;
  };

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Home Loan EMI Calculator</h3>
            <p className="text-[11px] text-slate-500">Estimate monthly payout & amortization</p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <ShieldCheck className="h-3 w-3" /> 80% Loan Support
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
        {/* Sliders Column */}
        <div className="space-y-4">
          {/* Loan Amount */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold mb-1">
              <span className="text-slate-600 dark:text-slate-400">Loan Amount</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatLakhCr(loanAmount)}</span>
            </div>
            <input
              type="range"
              min={1000000}
              max={100000000}
              step={500000}
              value={loanAmount}
              onChange={e => setLoanAmount(Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer dark:bg-slate-700"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>₹10 L</span>
              <span>₹10 Cr</span>
            </div>
          </div>

          {/* Interest Rate */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold mb-1">
              <span className="text-slate-600 dark:text-slate-400">Interest Rate</span>
              <span className="font-bold text-slate-900 dark:text-white">{interestRate}% p.a.</span>
            </div>
            <input
              type="range"
              min={6.5}
              max={14.0}
              step={0.1}
              value={interestRate}
              onChange={e => setInterestRate(Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer dark:bg-slate-700"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>6.5%</span>
              <span>14.0%</span>
            </div>
          </div>

          {/* Loan Tenure */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold mb-1">
              <span className="text-slate-600 dark:text-slate-400">Tenure</span>
              <span className="font-bold text-slate-900 dark:text-white">{tenureYears} Years</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={tenureYears}
              onChange={e => setTenureYears(Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer dark:bg-slate-700"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>5 Yrs</span>
              <span>30 Yrs</span>
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] uppercase font-bold text-slate-400">Estimated Monthly EMI</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                ₹{monthlyEmi.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-medium text-slate-500">/ month</span>
            </div>
          </div>

          {/* Ratio bar */}
          <div className="space-y-1.5 my-3">
            <div className="flex justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              <span>Principal ({principalRatio}%)</span>
              <span>Interest ({interestRatio}%)</span>
            </div>
            <div className="h-2 w-full flex rounded-full overflow-hidden">
              <div style={{ width: `${principalRatio}%` }} className="bg-blue-600 h-full" />
              <div style={{ width: `${interestRatio}%` }} className="bg-amber-400 h-full" />
            </div>
          </div>

          {/* Metrics Footer */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 text-xs">
            <div>
              <p className="text-[10px] text-slate-400">Total Interest</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">{formatLakhCr(totalInterest)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Total Payment</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">{formatLakhCr(totalPayment)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
