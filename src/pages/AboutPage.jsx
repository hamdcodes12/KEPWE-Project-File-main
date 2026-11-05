import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const brandFacts = [
  { label: 'Brand', value: 'KEPWE QUANT' },
  { label: 'Parent ecosystem', value: 'Healweal Corp' },
  { label: 'Core philosophy', value: 'Build Better' },
  { label: 'Positioning', value: 'Algorithmic Trading Technology' },
  { label: 'Core product', value: 'Kepwe Quant' }
];

const productCards = [
  {
    name: 'Kepwe Quant',
    headline: 'Trade Smarter.',
    description: 'Technology for systematic and algorithmic trading workflows, strategy configuration, analytics and broker connectivity.'
  }
];

const values = [
  'Build Better',
  'Customer First',
  'Simplicity',
  'Trust',
  'Innovation',
  'Responsibility',
  'Data Driven',
  'Long-Term Thinking'
];

const principles = [
  { title: 'Security by Design', description: 'Protect systems and information through responsible security practices.' },
  { title: 'Transparency by Design', description: 'Make important information understandable.' },
  { title: 'Compliance by Design', description: 'Consider applicable regulatory requirements from the beginning.' },
  { title: 'User Control', description: 'Give users appropriate control over their data, accounts and integrations.' },
  { title: 'Responsible Automation', description: 'Use automation while recognising its limitations and the importance of human oversight.' }
];

const AboutPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{ background: '#F8FAFC', color: '#0F172A', minHeight: '100vh', padding: '76px 20px 100px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <section style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto 52px' }}>
          <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.82rem', fontWeight: 800, padding: '7px 16px', borderRadius: '9999px', letterSpacing: '0.08em', display: 'inline-block', textTransform: 'uppercase' }}>
            KEPWE QUANT
          </span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, lineHeight: '1.05', margin: '18px 0 18px', color: '#0F172A', WebkitTextFillColor: '#0F172A' }}>
            Systematic Trading. Clearly Managed.
          </h1>
          <p style={{ color: '#475569', fontSize: '1.12rem', lineHeight: '1.75', maxWidth: '760px', margin: '0 auto' }}>
            Kepwe Quant is our flagship algorithmic trading platform for researching strategies, automating execution, connecting brokers, and managing risk.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '28px' }}>
            <a href="/quant" style={{ background: '#214ECF', color: '#FFFFFF', border: 'none', borderRadius: '10px', padding: '14px 24px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              Explore Kepwe Quant <ArrowRight size={16} />
            </a>
            <a href="/signup?product=quant&demo=24h" style={{ background: 'transparent', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '14px 24px', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Start 24-Hour Free Demo
              </a>
          </div>

        </section>

        <section style={{ background: 'linear-gradient(135deg, #0B1E4A 0%, #214ECF 100%)', color: '#fff', padding: '32px 28px', borderRadius: '22px', boxShadow: '0 20px 50px rgba(33,78,207,0.18)', marginBottom: '60px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '18px' }}>
            {brandFacts.map((item) => (
              <div key={item.label} style={{ padding: '16px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#BFDBFE', fontWeight: 800, marginBottom: '8px' }}>{item.label}</div>
                <div style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: '1.5' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>KEPWE QUANT • SYSTEMATIC TRADING</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, margin: '14px 0 12px', lineHeight: '1.1' }}>Systematic Trading Should Be Clear and Controlled.</h2>
          </div>
          <p style={{ maxWidth: '880px', margin: '0 auto', color: '#475569', fontSize: '1.08rem', lineHeight: '1.8', textAlign: 'center' }}>
            Trading strategies need a disciplined path from research to live execution, with clear performance data and risk controls at every step.
            <br /><br />
            Kepwe Quant brings strategy research, historical backtesting, automated execution, broker connectivity, and risk controls into one focused workspace.
            <br /><br />
            <strong style={{ color: '#0F172A' }}>We don't build technology for technology's sake. We build to solve real problems.</strong>
          </p>
        </section>

        <section style={{ marginBottom: '72px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '38px 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Healweal Philosophy</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Built on the Philosophy of Build Better.</h2>
          </div>
          <p style={{ color: '#475569', fontSize: '1.06rem', lineHeight: '1.8', maxWidth: '860px', margin: '0 auto 20px', textAlign: 'center' }}>
            Kepwe Quant is developed by Kepwe, part of the Healweal ecosystem, with a focus on clear and responsible trading technology.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', maxWidth: '840px', margin: '0 auto' }}>
            {['Better products.', 'Better technology.', 'Better experiences.', 'Better systems.'].map((item) => (
              <div key={item} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>{item}</div>
            ))}
          </div>
          <div style={{ marginTop: '26px', maxWidth: '860px', marginLeft: 'auto', marginRight: 'auto', padding: '20px 16px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <p style={{ margin: '0 0 10px', color: '#0F172A', fontWeight: 800 }}>We continuously ask:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', color: '#475569' }}>
              {['Can this be simpler?', 'Can this be faster?', 'Can this be smarter?', 'Can this be more transparent?', 'Can technology solve this better?'].map((question) => (
                <div key={question} style={{ padding: '8px 12px', borderRadius: '10px', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>{question}</div>
              ))}
            </div>
            <p style={{ marginTop: '18px', marginBottom: 0, color: '#0F172A', fontWeight: 800, textAlign: 'center' }}>If the answer is yes, we build.</p>
          </div>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Our Story</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 12px' }}>From Problems to Products.</h2>
          </div>
          <p style={{ maxWidth: '900px', margin: '0 auto 20px', color: '#475569', fontSize: '1.06rem', lineHeight: '1.8', textAlign: 'center' }}>
            Kepwe Quant was created around a simple observation: algorithmic trading technology is powerful, but often unnecessarily complicated.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', maxWidth: '980px', margin: '0 auto 20px' }}>
            {[
              'Strategy research can be spread across disconnected tools.',
              'Backtests need realistic market and cost assumptions.',
              'Manual execution makes consistent rules harder to follow.',
              'Risk controls should be part of every automated strategy.'
            ].map((item) => (
              <div key={item} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 16px', color: '#475569', lineHeight: '1.6', fontWeight: 500 }}>{item}</div>
            ))}
          </div>
          <p style={{ maxWidth: '900px', margin: '0 auto', color: '#475569', fontSize: '1.06rem', lineHeight: '1.8', textAlign: 'center' }}>
            Kepwe Quant brings these trading workflows together in one platform:
            <br /><br />
            <strong style={{ color: '#214ECF', fontSize: '1.2rem' }}>Kepwe Quant</strong>
            <br /><br />
            <strong>One flagship platform for systematic trading.</strong>
          </p>
        </section>

        <section style={{ marginBottom: '72px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '38px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>What We Build</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 8px' }}>KEPWE QUANT. One Trading Workspace.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
            {productCards.map((product) => (
              <div key={product.name} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '22px 18px', height: '100%' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 900, color: '#0F172A' }}>{product.name}</h3>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#214ECF', marginBottom: '12px' }}>{product.headline}</div>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.7' }}>{product.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Our Ecosystem</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Research → Backtest → Automate → Manage Risk</h2>
          </div>
          <div style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.06em', color: '#0F172A', marginTop: '8px' }}>
            KEPWE QUANT
          </div>
          <p style={{ maxWidth: '820px', margin: '22px auto 0', color: '#475569', textAlign: 'center', fontSize: '1.08rem', lineHeight: '1.8' }}>
            Kepwe Quant connects each step of a systematic trading workflow, from strategy design through broker execution and ongoing risk management.
          </p>
        </section>

        <section style={{ marginBottom: '72px', background: 'linear-gradient(135deg, #0F172A 0%, #162B5A 100%)', color: '#FFFFFF', borderRadius: '22px', padding: '32px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#BFDBFE', fontWeight: 800 }}>Our Vision</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px', color: '#FFFFFF', WebkitTextFillColor: '#FFFFFF' }}>To Make Systematic Trading More Accessible and Disciplined.</h2>
          </div>
          <p style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', color: '#E2E8F0', fontSize: '1.08rem', lineHeight: '1.8' }}>
            We build tools that help traders research ideas, validate them with historical data, connect supported brokers, and apply risk controls to automated execution.
          </p>
        </section>

        <section style={{ marginBottom: '72px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '38px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Our Mission</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Make Trading Workflows Simpler Through Technology.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '960px', margin: '0 auto' }}>
            {[
              ['Strategy Tools', 'Build and refine systematic trading rules.'],
              ['Market Data', 'Review historical performance and trading signals.'],
              ['Automation', 'Execute configured strategies through supported brokers.'],
              ['Risk Controls', 'Apply loss limits and safeguards to each workflow.']
            ].map(([title, text]) => (
              <div key={title} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 16px' }}>
                <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: '8px', fontSize: '1.05rem' }}>{title}</div>
                <div style={{ color: '#475569', lineHeight: '1.7' }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Our Values</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Build Better. Build With Purpose.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '1100px', margin: '0 auto' }}>
            {values.map((value, index) => (
              <div key={value} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 16px' }}>
                <div style={{ fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800, marginBottom: '8px' }}>0{index + 1} —</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '72px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '38px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Our Product Philosophy</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Simple Outside. Powerful Inside.</h2>
          </div>
          <ol style={{ maxWidth: '900px', margin: '0 auto', paddingLeft: '22px', color: '#475569', lineHeight: '1.9', fontSize: '1.02rem' }}>
            <li>Understand — We start with the problem.</li>
            <li>Design — We simplify the experience.</li>
            <li>Build — We use technology to create the solution.</li>
            <li>Test — We challenge assumptions and improve reliability.</li>
            <li>Scale — We build infrastructure capable of growing with our users.</li>
            <li>Improve — We never consider the product finished.</li>
          </ol>
          <div style={{ textAlign: 'center', marginTop: '24px', fontWeight: 800, fontSize: '1.2rem', color: '#0F172A' }}>Build → Learn → Improve → Build Better</div>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Responsible Innovation</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Innovation With Responsibility.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '1100px', margin: '0 auto' }}>
            {principles.map((item) => (
              <div key={item.title} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 16px' }}>
                <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: '8px', fontSize: '1.05rem' }}>{item.title}</div>
                <div style={{ color: '#475569', lineHeight: '1.7' }}>{item.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '72px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '38px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Our Technology</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Built for Modern Algorithmic Trading.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', maxWidth: '1000px', margin: '0 auto' }}>
            {['Strategy Research', 'Historical Backtesting', 'Broker Connectivity', 'Automated Execution', 'Market Analytics', 'Risk Management', 'Security', 'Execution Monitoring', 'Scalable Architecture'].map((item) => (
              <div key={item} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>{item}</div>
            ))}
          </div>
          <p style={{ maxWidth: '760px', margin: '24px auto 0', color: '#0F172A', fontWeight: 700, textAlign: 'center', fontSize: '1.08rem' }}>
            Powerful technology shouldn't feel complicated. It should simply work.
          </p>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Systematic Trading</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>A Disciplined Workflow from Research to Execution.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', maxWidth: '900px', margin: '0 auto 18px' }}>
            {[
              ['Research', 'Develop systematic trading strategies.'],
              ['Connect', 'Link a supported broker account.'],
              ['Manage Risk', 'Set safeguards and monitor execution.']
            ].map(([title, text]) => (
              <div key={title} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 16px' }}>
                <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: '8px', fontSize: '1.06rem' }}>{title}</div>
                <div style={{ color: '#475569', lineHeight: '1.7' }}>{text}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
          </div>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>KEPWE QUANT</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Research, Backtest, Automate, and Monitor.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '900px', margin: '0 auto 18px' }}>
            {[
              ['Backtest', 'Validate strategy behavior against historical data.'],
              ['Automate', 'Connect and run configured trading strategies.'],
              ['Manage Risk', 'Monitor exposure and apply defined safeguards.']
            ].map(([title, text]) => (
              <div key={title} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 16px' }}>
                <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: '8px', fontSize: '1.06rem' }}>{title}</div>
                <div style={{ color: '#475569', lineHeight: '1.7' }}>{text}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => navigate('/products')} style={{ background: '#214ECF', color: '#FFFFFF', border: 'none', borderRadius: '10px', padding: '12px 18px', fontWeight: 800, cursor: 'pointer' }}>
              Explore KEPWE QUANT →
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '72px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '38px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Trust</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Built to Earn Trust.</h2>
          </div>
          <p style={{ maxWidth: '840px', margin: '0 auto 20px', color: '#475569', lineHeight: '1.8', textAlign: 'center', fontSize: '1.06rem' }}>
            Trust isn't created by a tagline. It is created through transparency, security, reliability, responsible technology, clear communication and continuous improvement.
            <br /><br />
            <strong style={{ color: '#0F172A' }}>Our goal isn't simply to acquire users. It's to earn their trust.</strong>
          </p>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Company</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>Kepwe Quant, Built by Kepwe.</h2>
          </div>
          <p style={{ maxWidth: '840px', margin: '0 auto', color: '#475569', textAlign: 'center', lineHeight: '1.8' }}>
            Kepwe is part of Healweal Corp. Its flagship product is KEPWE QUANT, an algorithmic trading workspace for strategy research, automation, broker connectivity, and risk management.
          </p>
        </section>

        <section style={{ marginBottom: '72px' }}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Future</span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, margin: '14px 0 10px' }}>We're Just Getting Started.</h2>
          </div>
          <p style={{ maxWidth: '860px', margin: '0 auto', color: '#475569', lineHeight: '1.8', textAlign: 'center', fontSize: '1.08rem' }}>
            We continue improving Kepwe Quant with better research tools, broker connectivity, execution visibility, and risk controls.
            <br /><br />
            Our roadmap will continue to evolve around one question:
            <br /><br />
            <strong style={{ color: '#0F172A', fontSize: '1.3rem' }}>What's the better way to build this?</strong>
          </p>
        </section>

        <section style={{ marginBottom: '72px', background: 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 100%)', color: '#FFFFFF', borderRadius: '22px', padding: '40px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, margin: '0 0 18px', color: '#FFFFFF' }}>Let's Build Better.</h2>
          <p style={{ maxWidth: '860px', margin: '0 auto', color: '#E2E8F0', lineHeight: '1.8', fontSize: '1.08rem' }}>
            If you want to research, backtest, and automate a trading strategy with clear risk controls, Kepwe Quant is built for you.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '26px' }}>
            <button onClick={() => navigate('/')} style={{ background: '#FFFFFF', color: '#0F172A', border: 'none', borderRadius: '10px', padding: '14px 22px', fontWeight: 800, cursor: 'pointer' }}>
              Explore Kepwe Quant
            </button>
            <button onClick={() => navigate('/contact')} style={{ background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '10px', padding: '14px 22px', fontWeight: 800, cursor: 'pointer' }}>
              Talk to Us
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#214ECF', fontWeight: 800 }}>Brand Language</span>
          </div>
          <div style={{ maxWidth: '900px', margin: '0 auto', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '28px 22px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.78rem', marginBottom: '8px' }}>Primary brand line</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A' }}>Systematic Trading. Clearly Managed.</div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.78rem', marginBottom: '8px' }}>Supporting line</div>
              <div style={{ color: '#475569', fontSize: '1.08rem', lineHeight: '1.8' }}>Algorithmic trading software for strategy research, automation, broker connectivity, and risk management.</div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.78rem', marginBottom: '8px' }}>Brand philosophy</div>
              <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#0F172A' }}>Build Better.</div>
            </div>
            <div>
              <div style={{ color: '#475569', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.78rem', marginBottom: '8px' }}>Brand promise</div>
              <div style={{ color: '#475569', fontSize: '1.08rem', lineHeight: '1.8' }}>Research strategies. Automate execution. Manage risk with Kepwe Quant.</div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid #E2E8F0' }}>
          <p style={{ textAlign: 'center', color: '#475569', fontSize: '1.05rem', lineHeight: '1.8', maxWidth: '980px', margin: '0 auto' }}>
            Kepwe Quant brings strategy research, automated execution, broker connectivity, and risk management into one focused workspace. Our aim is to make systematic trading workflows clearer and easier to manage:
            <br /><br />
            <strong style={{ color: '#214ECF', fontSize: '1.7rem' }}>Build Better.</strong>
          </p>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
