import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import FloatingSchedulingButton from "@site/src/components/FloatingSchedulingButton";

import styles from "./index.module.css";

// Emoji are decorative here, so screen readers skip them (aria-hidden) and
// read only the sentence.
function Emoji({ children }) {
  return <span aria-hidden="true">{children}</span>;
}

function HeroSection() {
  return (
    <div className={styles.hero}>
      <div className={styles.heroInner}>
        <img
          src={require("@site/static/img/quinn-headshot-square.png").default}
          alt="Headshot of Quinn"
          width="144"
          height="144"
          className={styles.headshot}
        />
        <h1 className={styles.heroTitle}>Hi, I'm Quinn.</h1>

        <p className={styles.heroSubtitle}>
          I help people <Emoji>🧑‍🤝‍🧑</Emoji> and organizations{" "}
          <Emoji>🌐</Emoji> build systems <Emoji>⚙️</Emoji> that help them
          thrive. <Emoji>🌱</Emoji>
        </p>
        <div className={styles.heroIntro}>
          <p>
            As a <span className="font-light">CAPM-certified project manager</span>,{" "}
            <span className="font-light">software developer</span>, and{" "}
            <span className="font-light">process improvement engineer</span>, I love
            blending information technology, human-centered design, systems
            thinking, and compassionate leadership to{" "}
            <span className="font-light">co-create systems</span>,{" "}
            <span className="font-light">processes</span>, and{" "}
            <span className="font-light">tools</span> that help people do and create
            amazing things together.
          </p>
          <p>
            I care deeply about the impact of processes, infrastructure, norms,
            and incentives on organizational effectiveness, team synergy, and
            individual empowerment and love collaboratively developing robust
            frameworks, structures, and workflows that foster organizational
            alignment, promote collaborative excellence, and drive collective
            progress.
          </p>
          <p>
            Outside of my professional work, I've been a proud member of{" "}
            <a
              href="https://www.givingwhatwecan.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Giving What We Can
            </a>{" "}
            since 2018 and dedicate 10% of my income to high-impact charities.
          </p>
          <p>
            In September 2019, I completed a 4,230 mile bicycle tour across the
            United States to challenge myself, push my comfort zone, and expand
            my worldview. Learn more about the journey here —{" "}
            <a
              href="https://web.archive.org/web/20201128223402/https://tourde10percent.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              tourde10percent.com
            </a>
            .
          </p>
          <p>
            This site serves as a great aggregator for all of my technical
            projects, design work, and other things I do. You can also view my{" "}
            <Link to="/resume">resume</Link>, my{" "}
            <Link to="/impossible-list">Impossible List</Link>,{" "}
            <Link to="/books">books I've read</Link>, and the different{" "}
            <Link to="/travels">places I've been</Link>.
          </p>
          <p>
            In my leisure time, I enjoy listening to thought-provoking podcasts,
            jamming to{" "}
            <a
              href="https://youtu.be/yhtcG79kPNw"
              target="_blank"
              rel="noopener noreferrer"
            >
              jazz fusion
            </a>
            , attending to my digital garden, and indulging in BBC Nature
            documentaries.
          </p>
        </div>
      </div>
      <img
        src={require("@site/static/img/quinn-road.png").default}
        alt="Quinn with his loaded touring bicycle beside a sign reading “Quinn Road” on a gravel road through green prairie"
        loading="lazy"
        className={styles.bannerPhoto}
      />
      <div className={styles.photoPair}>
        <img
          src={require("@site/static/img/quinn-teaching.png").default}
          alt="Quinn presenting at a whiteboard to a group seated in a circle"
          loading="lazy"
          className={styles.pairPhoto}
        />
        <img
          src={require("@site/static/img/quinn-ireland.png").default}
          alt="Quinn standing at a railing above tall sea cliffs on the Irish coast"
          loading="lazy"
          className={styles.pairPhoto}
        />
      </div>
    </div>
  );
}

const TestimonialList = [
  {
    name: "Stephanie",
    title: "Director of People Operations, FORT Robotics",
    quote: (
      <>
        I had the pleasure of working closely with Quinn McHugh at FORT where we
        partnered on tacking some of the companies toughest communication
        challenges. Quinn's leadership was nothing short of transformative. Our
        project, spearheaded by him, resulted in a remarkable 30% increase in
        company-wide communication satisfaction, a testament to his ability to
        drive impactful change. Quinn was a major catalyst for organizational
        change and improvement. His amazing ability to stay on target and get
        things done was instrumental in the project's success. Quinn's
        dedication, focus, and relentless pursuit of excellence set him apart as
        a leader who always exceeds expectations. Without a doubt, I would hire
        Quinn in a second. His exceptional leadership, innovative thinking, and
        unwavering commitment to excellence make him an invaluable asset to any
        team. It was an absolute pleasure working with Quinn, and I look forward
        to seeing the incredible impact he will continue to make in his career.
      </>
    ),
  },
  {
    name: "Darren Weinhold",
    title: "Engineering Manager, The Fredericks Company",
    quote: (
      <>
        Quinn is great to work with and was an excellent hire. Although he was a
        new graduate, he possessed great technical skills and a high level of
        maturity. In his role, he showcased his ability to communicate with
        people regardless of their backgrounds and to collaborate with other
        engineers to solve problems. His communication skills in general are
        excellent; in particular, his writing is articulate and precise. His
        software engineering skills show similar traits to his communication.
        During our time working together, Quinn utilized Python to write several
        scripts to automate production tests. His code was clean and
        well-organized. As a Manufacturing Engineer, Quinn drew heavily on his
        background in mechanical engineering. He created numerous 3D assemblies
        of current products to allow models to be distributed to customers. He
        also created fixtures to aid operators in assembling products. Quinn set
        a high bar for himself whenever he took on a project and needed little
        management though was always open to feedback and suggestions
      </>
    ),
  },
  /**{
    name: "Dr. Smitesh Bakrania",
    title: "Associate Professor of Mechanical Engineering, Rowan University",
    quote: (
      <>
        There are some students that rise above what is offered by the typical
        engineering curriculum. Those that are driven by an innate sense of
        curiosity and purpose. Quinn exemplifies that. Quinn thrived in
        academics and took every opportunity to expand his experience at Rowan.
        While taking my Thermal-Fluid Sciences course, Quinn became interested
        in porting one of my engineering-related iOS apps (Clausius) to Android.
        This meant, studying the existing iOS app and its functionality,
        learning the Android development environment, and translating the same
        experience to a new space. When I offered Quinn to consider this as a
        "for-credit" project, he refused to let go of his existing engineering
        projects. He simply decided to pursue this as an add-on or a side
        project. Students who typically attempt this, quickly become overwhelmed
        by the time commitment and lose motivation. Yet, Quinn steadily met
        every milestone during his senior year. I am privileged to have students
        like Quinn and proud to have him represent Rowan Engineering.
      </>
    ),
  },**/
  {
    name: "Doug Wilson",
    title: "Director of Engineering, Inrad Optics",
    quote: (
      <>
        Quinn demonstrated the ability to multitask, work with others within the
        organization and self-direct his work to deliver solutions in a complex,
        ever-changing environment. The fact that he could do so over a short few
        months makes this even more impressive. Quinn is organized, thoughtful,
        and intelligent which are traits that will serve him well in any
        endeavor he wishes to apply himself.
      </>
    ),
  },
];

// A quote with its source: <figure>, <blockquote> and <figcaption> tell
// screen readers which words are the quote and who said them.
function Testimonial({ name, title, quote }) {
  return (
    <figure className={styles.testimonial}>
      <blockquote className={styles.testimonialQuote}>
        <p>{quote}</p>
      </blockquote>
      <figcaption className={styles.testimonialSource}>
        <b>{name}</b>
        <br />
        <i>{title}</i>
      </figcaption>
    </figure>
  );
}

function Testimonials() {
  return (
    <section
      className={styles.testimonialsSection}
      aria-labelledby="testimonials-heading"
    >
      <div className="container">
        <h2 id="testimonials-heading">Testimonials</h2>
        <div className={styles.testimonialGrid}>
          {TestimonialList.map((props, idx) => (
            <Testimonial key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Quinn McHugh's Personal Website"
    >
      <main>
        <HeroSection />
        <Testimonials />
      </main>
      <FloatingSchedulingButton />
    </Layout>
  );
}
