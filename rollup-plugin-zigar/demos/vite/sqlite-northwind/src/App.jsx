import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { __zigar, closeDb, findCustomers, getOrders, openDb } from '../zig/sqlite.zig';
import './App.css';
import northwind from './assets/northwind.jpg';
import { WebFile } from './web-file.js';

let data;

__zigar.on('open', async (evt) => {
  if (evt.path.endsWith('.sqlite3')) {
    return data ??= WebFile.create(northwind)
  } else {
    return false;
  }
})
__zigar.on('mkdir', () => true)
__zigar.on('rmdir', () => true)

function App() {
  const [ customers, setCustomers ] = useState([])
  const [ orders, setOrders ] = useState([])
  const [ searchString, setSearchString ] = useState('')
  const [ selectedCustomerID, setSelectedCustomerID ] = useState()
  const deferredSearchString = useDeferredValue(searchString)

  const onSearchChange = useCallback((evt) => {
    setSearchString(evt.target.value)
  }, [])
  const onCustomerClick = useCallback((evt) => {
    if (evt.target.tagName === 'LI') {
      setSelectedCustomerID(evt.target.dataset.customerId)
    }
  }, [])
  useEffect(() => {
    openDb('/db.sqlite3')
    return () => closeDb()
  }, [ openDb, closeDb ])
  useEffect(() => {
    findCustomers(deferredSearchString || '%').then(setCustomers)
  }, [ deferredSearchString, findCustomers ])
  useEffect(() => {
    if (selectedCustomerID !== undefined) {
      getOrders(selectedCustomerID).then(setOrders)
    } else {
      setOrders([])
    }
  }, [ selectedCustomerID, getOrders ])
  useEffect(() => {
    if (selectedCustomerID) {
      if (!customers.find(a => a.CustomerID === selectedCustomerID)) {
        setSelectedCustomerID(undefined)
      }
    }
  }, [ customers ])
  return (
    <>
      <div id="header">
        <input id="search" value={searchString} onChange={onSearchChange} />
      </div>
      <div id="content">
        <ul id="customer-list" onClick={onCustomerClick}>
          {customers.map(customer =>
            <li 
              key={customer.CustomerID} 
              className={customer.CustomerID === selectedCustomerID ? 'selected' : ''} 
              data-customer-id={customer.CustomerID}
              title={customer.Region}
            >
              {customer.CompanyName}
            </li>
          )}
        </ul>
        <ul id="order-list">
          {
            orders.map(order =>
              <li 
                key={order.OrderID} 
                data-order-id={order.OrderID}
              >
                {order.OrderDate} ${order.Total}
              </li>
            )
          }
        </ul>
      </div>
    </>
  )
}

export default App
