import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import styles from "./index.module.css";
import heroSectionBackground from '@site/static/img/hero-section-bg.png';

function HeroSection() {
  return (
<div className="relative bg-no-repeat bg-cover bg-center w-screen h-[5000px]" style={{ backgroundImage: `url(${heroSectionBackground})` }}>
  <div className="flex flex-col space-y-80">
    <div className="relative top-0 left-0 w-screen h-[calc(100vh-100px)]">
      <div className="flex flex-col items-center justify-center h-full text-[#F5F3EE]">
        <h1 className="font-thin text-3xl lg:text-5xl">
          Every system is perfectly designed to get the results it gets.
        </h1>
        <p className="font-normal text-xl lg:text-3xl mt-4">
          How well are your systems working for you?
        </p>
      </div>
    </div>
    <div className="flex justify-center items-center max-md:pr-5">
        <img
          loading="lazy"
          src={require('@site/static/img/quinn-teaching.png').default}
          alt="Quinn Teaching"
          className="w-full aspect-[2.17] max-w-[1579px] max-md:max-w-full"
        />
      </div>
      <div className="ml-40 w-[60vh] flex flex-col space-y-10 px-12 py-12 bg-sky-950">
      <img
        loading="lazy"
        src="https://cdn.builder.io/api/v1/image/assets/TEMP/8b4daac15003790d7ae76eaf0e9d4bbd8b38a01bbde5468dd607e5b69515abf1?apiKey=c2ecd5d95d864711b123d95e39ca9f25&"
        alt="Headshot of Quinn"
        className="w-36 max-w-full aspect-square"
      />
      <div className="text-[#F5F3EE]">
        <p>
          As a CAPM-certified project manager, software developer, and process
          improvement engineer, I blend information technology, human-centered
          design, systems thinking, and compassionate leadership to build and
          refine systems, processes, and tools that generate lasting positive
          change.
        </p>
        <p>
          Outside of my work, I serve as a community organizer of{" "}
          <a href="https://www.eaphiladelphia.org/">Effective Altruism Philadelphia</a>.
        </p>
        <p>
          I care deeply about the impact of processes, infrastructure, norms,
          and incentives on organizational effectiveness, team synergy, and
          individual empowerment. By collaborating with internal and external
          stakeholders, I aim to collaboratively develop robust frameworks,
          structures, and workflows that foster organizational alignment,
          promote collaborative excellence, and drive collective progress.
        </p>
        <p>
          Most notably, I completed a 4,230 mile bicycle tour across the United
          States to challenge myself, push my comfort zone, and expand my
          worldview. Learn more here about the journey here —{" "}
          <a href="https://web.archive.org/web/20201128223402/https://tourde10percent.com/">tourde10percent.com</a>.
        </p>
        <p>
          This site serves as a great aggregator for all of my technical
          projects, design work, and other things I do. You can also view my{" "}
          <a href="https://quinnmchugh.net/resume">resume</a>, my{" "}
          <a href="https://quinnmchugh.net/impossible-list">Impossible List</a>,{" "}
          <a href="https://quinnmchugh.net/books-ive-read">books I've read</a>, and the different{" "}
          <a href="https://quinnmchugh.net/places-ive-been">places I've been</a>.
        </p>
        <p>
          In my leisure time, I enjoy listening to though-provoking podcasts,
          jamming to <a href="https://youtu.be/yhtcG79kPNw">jazz fusion</a>, attending to
          my digital garden, and indugling in BBC Nature documentaries.
        </p>
      </div>
    </div>
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
          <div class="flex flex-col space-y-4 p-4">
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
