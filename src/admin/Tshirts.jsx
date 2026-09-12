import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

const SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];

export default function Tshirts() {
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("classmates")
      .select(
        "full_name,class_id,phone,tshirt_size,tshirt_quantity"
      );

    if (error) {
      console.error(error);
    }

    setClassmates(data || []);
    setLoading(false);
  }

  const orders = classmates.filter(
    (person) =>
      person.tshirt_size &&
      Number(person.tshirt_quantity) > 0
  );

  const total = useMemo(
    () =>
      orders.reduce(
        (sum, person) =>
          sum + Number(person.tshirt_quantity || 0),
        0
      ),
    [orders]
  );

  // Quantity per size across all orders
  const quantityBySize = useMemo(() => {
    const map = {};

    SIZES.forEach((size) => {
      map[size] = orders
        .filter((person) => person.tshirt_size === size)
        .reduce(
          (sum, person) =>
            sum + Number(person.tshirt_quantity || 0),
          0
        );
    });

    return map;
  }, [orders]);

  return (
    <div>

      <div className="page-header">

        <div>
          <p className="page-eyebrow">MERCHANDISE</p>
          <h1>T-Shirts</h1>
          <p>Manage reunion T-shirt orders.</p>
        </div>

        <button
          className="secondary-button"
          onClick={loadOrders}
          disabled={loading}
        >
          ↻ Refresh
        </button>

      </div>

      {/* SUMMARY — all 6 sizes + total */}
      <div className="summary-cards tshirt-summary-cards">

        <div>
          <span>Total Shirts</span>
          <strong>{total}</strong>
        </div>

        {SIZES.map((size) => (
          <div key={size}>
            <span>Size {size}</span>
            <strong>{quantityBySize[size]}</strong>
          </div>
        ))}

      </div>

      <div className="data-card">

        <div className="data-card-header">
          <div>
            <h2>T-Shirt Orders</h2>
            <p>{orders.length} classmates ordered shirts.</p>
          </div>
        </div>

        {loading ? (

          <div className="empty-message">
            Loading orders...
          </div>

        ) : orders.length === 0 ? (

          <div className="empty-message">
            <div className="empty-icon">👕</div>
            <strong>No T-shirt orders yet</strong>
            <p>
              Orders will appear here once classmates
              submit their registrations.
            </p>
          </div>

        ) : (

          <div className="table-scroll">

            <table className="admin-table">

              <thead>
                <tr>
                  <th>Classmate</th>
                  <th>Class ID</th>
                  <th>Phone</th>
                  <th>Size</th>
                  <th>Quantity</th>
                </tr>
              </thead>

              <tbody>

                {orders.map((person) => (
                  <tr key={person.class_id}>

                    <td>{person.full_name}</td>

                    <td>
                      <code>{person.class_id}</code>
                    </td>

                    <td>{person.phone}</td>

                    <td>
                      <span className="badge">
                        {person.tshirt_size}
                      </span>
                    </td>

                    <td>{person.tshirt_quantity}</td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}
