import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div class="hero__bio">
          <p>
            My name is Quinn and I'm a mechanical engineer, software developer,
            designer, and aspiring project manager possessing interests in{" "}
            <a href="https://en.wikipedia.org/wiki/Continual_improvement_process">
              continuous improvement
            </a>
            , process design, workflow optimization, personal development,
            knowledge management, meta-learning, organizational culture, and
            high-impact charitable giving.
          </p>
          <p>
            Outside of my professional life, I serve as a volunteer community
            organizer of{" "}
            <a href="https://web.archive.org/web/20211217045253/https://www.meetup.com/eaphiladelphia/">
              Effective Altruism Philadelphia
            </a>
            , a global community of passionate people dedicated to using their
            careers, donations, time, and other resources to effect positive
            change in high-impact ways.
          </p>
          <p>
            I'm also an avid bicycle traveler. In 2019, I completed a{" "}
            <a href="https://web.archive.org/web/20211217045253/https://web.archive.org/web/20201128223402/https://tourde10percent.com/">
              4,230 bicycle tour
            </a>{" "}
            across the United States to challenge myself, push my comfort zone,
            and expand my worldview. You can see my other travels on{" "}
            <a href="https://www.polarsteps.com/QuinnPMcHugh">
              my Polarsteps profile.
            </a>
            .
          </p>
          <p>
            This site serves as a great aggregator for all of my{" "}
            <a href="https://web.archive.org/web/20211217045253/http://quinnmchugh.net/#projects">
              technical projects
            </a>
            ,{" "}
            <a href="https://web.archive.org/web/20211217045253/http://quinnmchugh.net/#design">
              artwork
            </a>
            , and other things I do. You can also{" "}
            <a href="https://web.archive.org/web/20211217045253/http://quinnmchugh.net/resume/">
              view my resume
            </a>
            , my{" "}
            <a href="https://web.archive.org/web/20211217045253/http://quinnmchugh.net/my-impossible-list/">
              <em>Impossible List</em>
            </a>
            ,{" "}
            <a href="https://web.archive.org/web/20211217045253/http://quinnmchugh.net/books-ive-read/">
              books I’ve read
            </a>
            , and the{" "}
            <a href="https://web.archive.org/web/20211217045253/http://quinnmchugh.net/where-ive-been/">
              different places I've been
            </a>{" "}
            in and around the United States.
          </p>
          <p>
            In my leisure time, I enjoy listening to though-provoking podcasts,
            (not) troubleshooting my 3D printer, designing logos in Illustrator,
            bopping to jazz funk, and indulging in the latest BBC Nature
            documentary.
          </p>
        </div>
        <div className={styles.buttons}>
          {/*
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Docusaurus Tutorial - 5min ⏱️
          </Link>
  */}
        </div>
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
      <main>{/*<HomepageFeatures />*/}</main>
    </Layout>
  );
}
