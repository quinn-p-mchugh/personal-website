import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import styles from "./index.module.css";
import heroSectionBackground from "@site/static/img/hero-section-bg.png";

function HeroSection() {
  return (
    <div class="hero flex flex-col items-center space-y-10">
      <div class="flex px-20 flex-col items-center w-screen space-y-10 text-center">
        <img
          loading="lazy"
          src={require("@site/static/img/quinn-headshot-square.png").default}
          alt="Headshot of Quinn"
          className="h-36 rounded-full"
        />
        <p style={{ fontSize: "4rem", fontWeight: 250 }}>Hi, I'm Quinn.</p>

        <p style={{ fontSize: "2.5rem", fontWeight: 250 }}>
          I help people 🧑‍🤝‍🧑 and organizations 🌐 build systems ⚙️ that help them
          thrive. 🌱
        </p>
        <div
          class="bg-black bg-opacity-20 p-10"
          style={{ fontSize: "1.5rem", fontWeight: 250 }}
        >
          <p class>
            As a <span class="font-light">CAPM-certified project manager</span>,{" "}
            <span class="font-light">software developer</span>, and{" "}
            <span class="font-light">process improvement engineer</span>, I love
            blending information technology, human-centered design, systems
            thinking, and compassionate leadership to{" "}
            <span class="font-light">co-create systems</span>,{" "}
            <span class="font-light">processes</span>, and{" "}
            <span class="font-light">tools</span> that help people do and create
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
            my worldview. Learn more here about the journey here —{" "}
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
            <a
              href="https://quinnmchugh.net/resume"
              target="_blank"
              rel="noopener noreferrer"
            >
              resume
            </a>
            , my{" "}
            <a
              href="https://www.quinnmchugh.net/docs/impossible-list"
              target="_blank"
              rel="noopener noreferrer"
            >
              Impossible List
            </a>
            ,{" "}
            <a
              href="https://quinnmchugh.net/books-ive-read"
              target="_blank"
              rel="noopener noreferrer"
            >
              books I've read
            </a>
            , and the different{" "}
            <a
              href="https://quinnmchugh.net/places-ive-been"
              target="_blank"
              rel="noopener noreferrer"
            >
              places I've been
            </a>
            .
          </p>
          <p>
            In my leisure time, I enjoy listening to though-provoking podcasts,
            jamming to{" "}
            <a
              href="https://youtu.be/yhtcG79kPNw"
              target="_blank"
              rel="noopener noreferrer"
            >
              jazz fusion
            </a>
            , attending to my digital garden, and indugling in BBC Nature
            documentaries.
          </p>
        </div>
      </div>
      <div
        class="relative overflow-hidden"
        style={{ height: "63vh", maxHeight: "45vh", minHeight: "72vh" }}
      >
        <img
          src={require("@site/static/img/quinn-road.png").default}
          alt="Quinn Road"
          className="min-w-screen object-contain"
          style={{ minWidth: "100vw" }}
        />
      </div>
      <div class="flex flex-row">
        <img
          src={require("@site/static/img/quinn-teaching.png").default}
          alt="Quinn Road"
          className="relative overflow-hidden object-contain"
          style={{ height: "50vw" }}
        />
        <img
          src={require("@site/static/img/quinn-ireland.png").default}
          alt="Quinn Road"
          className="relative overflow-hidden object-contain"
          style={{ height: "50vw" }}
        />
      </div>
    </div>
  );
}

const TestimonialList = [
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
  {
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
  },
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

function Testimonial({ name, title, quote }) {
  return (
    <div className={clsx(" col col--4 padding-horiz--md")}>
      <div className="text--left padding-horiz--md">
        <p>"{quote}"</p>
        <p>
          <ul>
            <li>
              <b>{name}</b>
              <br />
              <i>{title}</i>
            </li>
          </ul>
        </p>
      </div>
    </div>
  );
}

function Testimonials() {
  return (
    <section>
      <div className="container">
        <h1>Testimonials</h1>
        <br></br>
        <div className="testimonials">
          <div class="flex flex-row space-y-4 p-4 overflow-x-scroll">
            {TestimonialList.map((props, idx) => (
              <Testimonial key={idx} {...props} />
            ))}
          </div>
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
      <HeroSection />
      <Testimonials />
    </Layout>
  );
}
