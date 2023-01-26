import React from "react";
import clsx from "clsx";

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

export default function Testimonials() {
  return (
    <section>
      <div className="container">
        <h1>Testimonials</h1>
        <br></br>
        <div className="testimonials">
          <div className="row">
            {TestimonialList.map((props, idx) => (
              <Testimonial key={idx} {...props} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
