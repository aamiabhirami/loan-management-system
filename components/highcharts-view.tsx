"use client";

import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

export default function HighchartsView({ options }: { options: Highcharts.Options }) {
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
