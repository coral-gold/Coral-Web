import React from 'react';
import PublicLayout from '../../components/PublicLayout';
import FAQAccordion from '../../components/FAQAccordion';

const ITEMS = [
  {
    q: 'What is Coral Gold?',
    a: 'Coral Gold is a CZ (Cubic Zirconia) Rose Gold jewellery manufacturer with over five years of experience, working with both wholesalers and end customers.',
  },
  {
    q: 'How can I become a wholesale buyer (Party)?',
    a: 'Contact us via the Contact page, phone, or WhatsApp. Once approved, we create your Wholesaler login (Party ID + Password) and share it with you directly.',
  },
  {
    q: 'I already have a Wholesaler ID — where do I log in?',
    a: 'Click "Wholesaler Login" at the top of any page.',
  },
  {
    q: 'Can I buy or place an order directly on this website?',
    a: 'The public catalog is for browsing only. Wholesale buyers place quotation requests after logging in; individual customers should contact us directly.',
  },
  {
    q: 'How do I get pricing for a product?',
    a: "Pricing is always handled directly by call/WhatsApp/email — it's never shown or calculated on the website.",
  },
];

export default function FAQ() {
  return (
    <PublicLayout>
      <section className="hero" style={{ padding: '64px 20px' }}>
        <div className="container">
          <h1>Frequently Asked Questions</h1>
          <div className="gold-line" />
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <FAQAccordion items={ITEMS} />
        </div>
      </section>
    </PublicLayout>
  );
}
