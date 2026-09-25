import React, { useState } from 'react';
import { Search, BookOpen, Clock, ArrowRight } from 'lucide-react';

const POSTS = [
  { id: 1, title: 'Union Budget 2025-26: Key Tax Slab Changes & GST Amendments for SMEs', cat: 'Tax Updates', date: 'Aug 2026', readTime: '5 min read', desc: 'Detailed breakdown of revised income tax rates, TCS modifications, and MSME payment terms under Section 43B(h).' },
  { id: 2, title: 'How to Respond to a GST Notice (ASMT-10 or DRC-01) without Fines', cat: 'GST Advice', date: 'Jul 2026', readTime: '7 min read', desc: 'Step-by-step procedure for preparing mathematical reconciliations and submitting responses on the GST portal.' },
  { id: 3, title: 'Why 80% of Startups Fail MCA Filings & How to Avoid DIN Deactivation', cat: 'ROC Compliance', date: 'Jul 2026', readTime: '6 min read', desc: 'Understanding Form DIR-3 KYC, annual AOC-4 requirements, and penalty calculations under Companies Act.' },
];

const BlogPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPosts = POSTS.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="blog-page section-padding">
      <div className="container">
        
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 40px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <BookOpen size={14} /> KEPWE INSIGHTS & JOURNAL
          </div>
          <h1 className="heading-xl">
            Indian Tax & Business <span className="text-gradient">Knowledge Hub</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            In-depth guides, compliance updates, and financial strategies written by seasoned Chartered Accountants.
          </p>

          <div style={{ position: 'relative', maxWidth: '480px', margin: '24px auto 0' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input 
              type="text"
              placeholder="Search articles (e.g., GST, Budget, ROC)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '9999px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
          {filteredPosts.map(post => (
            <div key={post.id} className="glass-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="badge badge-blue">{post.cat}</span>
                <span className="text-xs text-muted"><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />{post.readTime}</span>
              </div>
              <h3 className="heading-sm" style={{ margin: '8px 0' }}>{post.title}</h3>
              <p className="text-sm text-muted" style={{ marginTop: '8px', lineHeight: '1.6' }}>{post.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default BlogPage;
