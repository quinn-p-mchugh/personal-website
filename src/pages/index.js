import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Testimonials from "@site/src/components/Testimonials";

import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="hero__container">
        <h1 className="hero__title">Hi! I'm Quinn.</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div class="hero__bio">
          <p>
            I'm a mechanical engineer, software developer, designer, and
            aspiring project manager with a passion for organizational culture,
            operational excellence, information science, thoughtful design, and
            effective giving. Outside of my professional life, I serve as a
            volunteer community organizer of{" "}
            <a href="https://www.meetup.com/eaphiladelphia" target="_blank">
              Effective Altruism Philadelphia
            </a>
            , a global community of individuals dedicated to using their
            careers, donations, time, and other resources to effect positive
            change in high-impact ways.
          </p>
          <p>
            Most notably, I completed a 4,230 mile bicycle tour across the
            United States to challenge myself, push my comfort zone, and expand
            my worldview. Learn more here about the journey here —{" "}
            <a
              href="https://web.archive.org/web/20211217045253/https://web.archive.org/web/20201128223402/https://tourde10percent.com/"
              target="_blank"
            >
              tourde10percent.com
            </a>
            .
          </p>
          <p>
            This site serves as a great aggregator for all of my{" "}
            <a href="./docs/category/projects">technical projects</a>,{" "}
            <a href="https://www.instagram.com/qm_creative/" target="_blank">
              artwork
            </a>
            , and other things I do. You can also{" "}
            <a href="./resume">view my resume</a>,{" "}
            <a href="./books">books I’ve read</a>, and the{" "}
            <a href="./travels/">different places I've been</a> in and around
            the United States.
          </p>
          <p>
            In my leisure time, I enjoy listening to though-provoking podcasts,
            tinking with my{" "}
            <a href="https://obsidian.md/" target="_blank">
              Obsidian
            </a>{" "}
            vault, bopping to jazz funk, and indulging in the latest BBC Nature
            documentary.
          </p>
          <p>
            Looking to get in touch? I'd love to. Please see my{" "}
            <a href="./contact">contact page</a>.
          </p>
        </div>
        <h2>
          🏗️{" "}
          <b>
            Please pardon the look and feel of this site - it's under
            construction!
          </b>{" "}
          🏗️
        </h2>
        {/*<div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Docusaurus Tutorial - 5min ⏱️
          </Link>
          </div>*/}
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Quinn McHugh's Personal Website"
    >
      <HomepageHeader />
      <main>{<Testimonials />}</main>
    </Layout>
  );
}
